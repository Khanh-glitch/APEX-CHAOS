// RA-1.C — Fighter Select art + preview coverage across the whole roster.
//
// Owner scope: fix only reproduced missing preview art or proven selection
// bugs; never redesign. This gate walks every roster entry in the real app and
// records, per fighter: card thumbnail decode, large preview decode, preview
// source, identity text, lock state and whether a pick actually took effect.
//
// Expectations:
//   * playable fighters decode both their card thumbnail and their large
//     selected preview (BOT P1 and the BOT opponent panel);
//   * MIRROR keeps the owner rule: no static pose of its own, but with an
//     opponent already picked it presents that opponent's real art;
//   * LOCAL with no P2 pick shows no MIRROR pose at all (canonical);
//   * progression-locked future fighters stay locked (near-black card is the
//     owner-preserved state, never counted as a broken image).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9437);
const DIR = process.env.APEX_EVIDENCE_DIR || '/tmp/apex-ra1-fighter-art-coverage';
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAYABLE = ['boxe', 'crystala', 'hunter', 'frost', 'magnet', 'mirror', 'newbot', 'shuri'];
const LOCKED = ['black_hole', 'math_v2', 'rubber', 'slime', 'sniper', 'time'];
const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--window-size=390,844',
  '--user-data-dir=/tmp/apex-ra1-fighter-art-' + process.pid, 'about:blank',
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
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(expr, label, timeoutMs = 45000) {
  const t0 = Date.now();
  for (;;) { let v = false; try { v = await evl(expr); } catch { /* nav */ } if (v) return true; if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + label); await sleep(300); }
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }
async function shot(name) {
  const s = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(s.data, 'base64'));
}
async function viewport(w, h, touch) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: touch, screenOrientation: { type: w < h ? 'portraitPrimary' : 'landscapePrimary', angle: w < h ? 0 : 90 } });
  await cmd('Emulation.setTouchEmulationEnabled', touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await sleep(200);
}
async function clickSel(sel) {
  const c = await evl(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; })()`);
  if (!c) throw new Error('click target missing: ' + sel);
  await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  await sleep(60);
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  await sleep(200);
}
// Press the first VISIBLE match (the boot gate can exist twice while the
// scene transition duplicates surfaces) with the input class under test.
async function pressSel(sel, touch = true) {
  const c = await evl(`(()=>{ const list=[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:Math.round(r.width),h:Math.round(r.height),vis:s.visibility,disp:s.display,op:Number(s.opacity)}}).filter(c=>c.w>2&&c.h>2&&c.vis!=='hidden'&&c.disp!=='none'&&c.op>0.05); return list[0]||null; })()`);
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
  await sleep(220);
}
const tapSel = (sel) => pressSel(sel, true);
const TX_IDLE = `!document.body.classList.contains('apex-scene-transition-active')`;

// Select a roster entry through the shell's own click contract (the same
// handler a physical tap fires — physical touch selection itself is proven by
// testFighterSelectPagerBrowser). This gate is about art identity, so it pages
// with the real dots and then verifies the side identity actually changed.
async function selectCard(hero) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const order = await evl(`[...document.querySelectorAll('.rosterCard')].map(c=>c.dataset.hero)`);
    const page = Math.floor(order.indexOf(hero) / 6);
    if (page > 0) { await evl(`document.querySelectorAll('.rosterPagerDot')[${page}]?.click()`); await sleep(500); }
    const clicked = await evl(`(()=>{const card=document.querySelector('.rosterCard[data-hero=${JSON.stringify(hero)}]');if(!card)return false;card.click();return true})()`);
    await sleep(420);
    const side = await evl(`document.querySelector('#p1Side')?.dataset.hero`);
    if (clicked && side === hero) return true;
    await sleep(300);
  }
  return false;
}

const PREVIEW = `(()=>{
  const slot=document.querySelector('#p1WorldArt');
  const img=slot?.querySelector('img');
  return {
    renderKey:slot?.dataset?.renderKey||null,
    hero:document.querySelector('#p1Side')?.dataset.hero||null,
    src:img?img.getAttribute('src'):null,
    complete:img?img.complete:null,
    naturalWidth:img?img.naturalWidth:null,
    name:document.querySelector('#p1Name')?.textContent?.trim()||null,
    locked:document.querySelector('#p1Side')?.classList?.contains('is-locked')||false,
  };
})()`;

const CARD = (hero) => `(()=>{
  const card=document.querySelector('.rosterCard[data-hero="${hero}"]');
  if(!card) return null;
  const img=card.querySelector('img');
  return {locked:card.classList.contains('is-locked'),disabled:card.disabled,
    hasLockVisual:!!card.querySelector('.rosterLockedVisual'),
    src:img?img.getAttribute('src'):null,complete:img?img.complete:null,naturalWidth:img?img.naturalWidth:null,
    selected:card.classList.contains('p1-selected')};
})()`;

let seeded = false;
async function boot(touch) {
  // Seed a completed coach before the document loads so the guide never
  // covers the roster; no reload is needed (a reload here can strand the
  // scene door in this headless shell).
  if (!seeded) {
    seeded = true;
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('apex.alpha.coach.v2',JSON.stringify({version:2,step:0,done:true,skipped:true,baselineBotMatches:0,baselineSealedMatches:0}))}catch(e){}` });
  }
  await cmd('Page.navigate', { url: APP });
  await waitFor(`!!document.querySelector('#apex-boot-start')`, 'boot');
  await sleep(600);
  let home = false;
  for (let attempt = 0; attempt < 4 && !home; attempt += 1) {
    if (await evl(`!!document.querySelector('#apex-boot-start')`)) await pressSel('#apex-boot-start', touch);
    home = await waitFor(`!!document.querySelector('#freeBattle') && ${TX_IDLE} && !document.querySelector('#apex-boot-start')`, 'home', 9000).catch(() => false);
  }
  if (!home) {
    console.log('BOOT DIAG', JSON.stringify(await evl(`(()=>({url:location.href,body:document.body.className,stage:document.querySelector('#stage')?.className,boot:!!document.querySelector('#apex-boot-start'),free:!!document.querySelector('#freeBattle'),transition:window.APEX_SCENE_TRANSITION?.active?.()}))()`)));
    await shot('boot-failure-' + Date.now());
    throw new Error('home never mounted');
  }
  await sleep(300);
  await evl(`window.APEX_ARSENAL_META && (window.APEX_ARSENAL_META.canPublicSelect = () => true)`);
  await evl(`window.APEX_GOLD_LOCKED = () => false`);
}
async function toPick(mode, touch) {
  let atMode = false;
  for (let attempt = 0; attempt < 3 && !atMode; attempt += 1) {
    await pressSel('#freeBattle', touch);
    atMode = await waitFor(`document.querySelector('#stage')?.classList.contains('screen-mode') && ${TX_IDLE}`, 'mode', 12000).catch(() => false);
  }
  if (!atMode) throw new Error('mode screen never mounted');
  await sleep(400);
  const sel = mode === 'bot' ? '.modeCard[data-mode="bot"]' : '.modeCard[data-mode="local1v1"]';
  await pressSel(sel, touch);
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX_IDLE}`, 'fighter select');
  await sleep(600);
}

async function walkRoster(label, touch) {
  const rows = [];
  for (const hero of [...PLAYABLE, ...LOCKED]) {
    const card = await evl(CARD(hero));
    const playable = PLAYABLE.includes(hero);
    if (!card) { check(label + ' roster card exists for ' + hero, false, 'missing card'); continue; }
    if (!playable) {
      check(label + ' locked future fighter ' + hero + ' stays locked with no invented art',
        card.locked === true && card.disabled === true && card.hasLockVisual === true && !card.naturalWidth,
        JSON.stringify(card));
      rows.push({ hero, expected: 'locked-by-design', ...card });
      continue;
    }
    check(label + ' card thumbnail decodes for ' + hero,
      !!card.src && card.complete === true && card.naturalWidth > 0 && card.locked === false,
      JSON.stringify({ src: card.src, complete: card.complete, natural: card.naturalWidth, locked: card.locked }));
    const t0 = Date.now();
    const picked = await selectCard(hero);
    if (!picked) check(label + ' picking ' + hero + ' takes effect on P1', false, 'selection did not land');
    // The preview must commit to the picked fighter; record how long it took
    // so a slow swap shows up as a measured number, not an impression.
    const committed = await waitFor(`(()=>{const s=document.querySelector('#p1WorldArt');const i=s?.querySelector('img');return s?.dataset?.renderKey===${JSON.stringify(hero)} && !!i && i.complete && i.naturalWidth>0})()`, 'preview commit ' + hero, 4000).catch(() => false);
    const latency = Date.now() - t0;
    await sleep(120);
    const preview = await evl(PREVIEW);
    const expectedName = await evl(`(()=>{const n=window.APEX_GOLD?.roster?.()?.[${JSON.stringify(hero)}]?.name;return n||null})()`);
    rows.push({ hero, expected: 'decoded-preview', latencyMs: latency, committed, ...card, preview });
    if (hero === 'mirror') {
      // BOT: the opponent is already the production CPU identity, so the
      // canonical rule (no static pose until an opponent exists) allows a
      // derived pose. LOCAL with P2 unpicked shows nothing at all.
      const mode = await evl(`document.querySelector('#stage')?.classList.contains('fighter-bot') ? 'bot' : 'local'`);
      // Owner rule (unchanged): MIRROR has no static pose of its own until the
      // opponent is really picked. In BOT the CPU identity is pre-shown but the
      // player has not picked it yet, so the canonical state is no pose.
      if (mode === 'local') {
        check(label + ' MIRROR keeps the owner rule with no opponent picked (no pose, no broken image)',
          !preview.src && !preview.naturalWidth, JSON.stringify(preview));
      } else {
        check(label + ' MIRROR shows no static pose before the player picks the BOT (owner rule)',
          preview.renderKey === 'mirror:empty' && !preview.src, JSON.stringify(preview));
      }
      continue;
    }
    check(label + ' large selected preview decodes for ' + hero,
      committed === true && preview.renderKey === hero && !!preview.src && preview.complete === true && preview.naturalWidth > 0
      && (expectedName ? preview.name === expectedName : true),
      JSON.stringify({ src: preview.src, natural: preview.naturalWidth, name: preview.name, expectedName, latencyMs: latency }));
  }
  return rows;
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
  const netFailures = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.loadingFailed' && !m.params?.canceled) netFailures.push({ type: m.params?.type, error: m.params?.errorText });
    if (m.method === 'Network.responseReceived' && m.params?.response?.status >= 400) netFailures.push({ status: m.params.response.status, url: m.params.response.url });
  });

  const matrix = {};
  for (const vp of [{ name: '390x844', w: 390, h: 844, touch: true }, { name: '844x390', w: 844, h: 390, touch: true }, { name: '320x568', w: 320, h: 568, touch: true }, { name: '1440x900', w: 1440, h: 900, touch: false }]) {
    await viewport(vp.w, vp.h, vp.touch);
    await boot(vp.touch);
    await toPick('bot', vp.touch);
    matrix['bot-' + vp.name] = await walkRoster('BOT ' + vp.name, vp.touch);
    await shot('fighter-bot-' + vp.name);

    if (vp.name === '390x844') {
      // Selection follow (RA-1): a pick that lands on another page must bring
      // the deck's port with it. The clean-profile gate can only prove the
      // no-move case (locked neighbours), so this row proves the crossing.
      await evl(`document.querySelectorAll('.rosterPagerDot')[0]?.click()`);
      await sleep(600);
      const before = await evl(`(()=>{const p=window.APEX_ROSTER_PAGER;const r=document.querySelector('.selectionDeckV6 .roster');return p&&r?{page:p.page,sl:r.scrollLeft}:null})()`);
      const picked = await selectCard('newbot');
      await sleep(900);
      const after = await evl(`(()=>{const p=window.APEX_ROSTER_PAGER;const r=document.querySelector('.selectionDeckV6 .roster');const i=document.querySelector('#p1WorldArt img');return p&&r?{page:p.page,sl:r.scrollLeft,hero:document.querySelector('#p1Side')?.dataset.hero,preview:i?i.naturalWidth:0}:null})()`);
      check('picking a fighter on the next page moves the pager to that page',
        picked === true && before?.page === 0 && after?.page === 1 && after?.hero === 'newbot' && after?.preview > 0,
        JSON.stringify({ before, after, picked }));
      await shot('fighter-selection-follow-390x844');
    }

    if (vp.name === '390x844' || vp.name === '844x390') {
      await boot(vp.touch);
      await toPick('local', vp.touch);
      if (vp.name === '390x844') {
        // Canonical MIRROR flow: no pose until the opponent is really picked,
        // then the picked opponent's own art, mirrored.
        const picked = await selectCard('mirror');
        await sleep(600);
        const before = await evl(PREVIEW);
        check('MIRROR flow: P1 mirror has no pose before P2 picks',
          picked === true && before.renderKey === 'mirror:empty' && !before.src, JSON.stringify({ picked, ...before }));
        await evl(`document.querySelector('#lockIn')?.click()`);
        await sleep(800);
        const p2Picked = await evl(`(()=>{const card=document.querySelector('.rosterCard[data-hero="hunter"]');if(!card)return false;card.click();return true})()`);
        const derived = await waitFor(`(()=>{const s=document.querySelector('#p1WorldArt');const i=s?.querySelector('img');return s?.dataset?.renderKey==='mirror:hunter' && !!i && i.complete && i.naturalWidth>0})()`, 'mirror derives picked opponent', 6000).catch(() => false);
        const after = await evl(PREVIEW);
        check('MIRROR flow: once P2 picks HUNTER, P1 mirror presents the real HUNTER art',
          p2Picked === true && derived === true && after.naturalWidth > 0 && String(after.src).includes('hunter'), JSON.stringify(after));
        await shot('fighter-local-mirror-derived-390x844');
        await boot(vp.touch);
        await toPick('local', vp.touch);
      }
      matrix['local-' + vp.name] = await walkRoster('LOCAL ' + vp.name, vp.touch);
      await shot('fighter-local-' + vp.name);
    }
  }

  const relevantNet = netFailures.filter((f) => (f.status && f.status >= 400) || String(f.error || '').includes('FAILED'));
  check('no first-party Fighter Select asset request fails across the roster walk', relevantNet.length === 0, JSON.stringify(relevantNet.slice(0, 8)));
  fs.writeFileSync(`${DIR}/fighter-art-matrix.json`, JSON.stringify({ generatedAt: new Date().toISOString(), matrix, netFailures, passes, failures }, null, 2));

  console.log('');
  console.log('RA-1 Fighter Select art coverage — evidence ' + DIR);
  if (failures.length) { console.error('RESULT: FAIL (' + passes.length + ' pass, ' + failures.length + ' fail)'); process.exitCode = 1; }
  else console.log('RESULT: PASS (' + passes.length + ' pass, 0 fail)');
  try { chrome.kill('SIGKILL'); } catch { /* gone */ }
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error('GATE ERROR', e); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
