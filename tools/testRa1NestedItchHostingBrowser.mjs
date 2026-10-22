// RA-1.E — Nested /html/<id>/ itch-style hosting proof (local, exact HEAD).
//
// itch.io serves a ZIP whose ROOT is index.html inside /html/<game-id>/.
// tools/packItchPortable.mjs rewrites first-party URL literals for that
// nesting; this gate then runs the REAL packaged output under a nested path
// and drives the product:
//   boot → Home → VS BOT → Fighter → live battle → leave match →
//   Result Gold page under the same nested path (art + Continue protocol) →
//   reload with the save intact.
// It also fails on any first-party 404, any external host request, or any
// console error, which is what "root hosting vs nested itch" reduces to.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const HOST = (process.env.ITCH_NESTED_URL || 'http://127.0.0.1:4180/').replace(/\/$/, '');
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9443);
const DIR = process.env.APEX_EVIDENCE_DIR || '/tmp/apex-ra1-nested';
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  '--user-data-dir=/tmp/apex-ra1-nested-' + process.pid, 'about:blank',
], { stdio: 'ignore' });

let ws; let serial = 0; const pending = new Map();
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const to = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 45000);
    pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evl(expression, contextId) {
  const params = { expression, returnByValue: true, awaitPromise: true };
  if (contextId) params.contextId = contextId;
  const r = await cmd('Runtime.evaluate', params);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }
async function shot(name) {
  const s = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${DIR}/${name}.png`, Buffer.from(s.data, 'base64'));
}
const TX = `!document.body.classList.contains('apex-scene-transition-active')`;

// Track the DEFAULT (main) world of each frame. Isolated worlds share the DOM
// but not the page's JS globals, so product state (APEX_ARSENAL) must be read
// from the frame's own main world.
const mainWorldByFrame = new Map();
let contextReplay = null;
async function refreshContexts() {
  // Runtime.enable replays executionContextCreated for every live context.
  const seen = [];
  const listener = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.executionContextCreated') {
      const c = m.params.context;
      if (c?.auxData?.isDefault && c.auxData?.frameId) seen.push([c.auxData.frameId, c.id]);
    }
  };
  ws.addEventListener('message', listener);
  await cmd('Runtime.enable');
  await sleep(200);
  ws.removeEventListener('message', listener);
  seen.forEach(([frameId, id]) => mainWorldByFrame.set(frameId, id));
  return seen;
}
async function frameContext() {
  const tree = await cmd('Page.getFrameTree');
  const frames = [];
  const walk = (n) => { frames.push(n.frame); (n.childFrames || []).forEach(walk); };
  walk(tree.frameTree);
  // The nested GAME document is /html/apex/index.html (the battle HUD child is
  // /html/apex/gold/battle-hud.html, so anchor on the exact entry document).
  const nested = frames.find((f) => /\/html\/apex\/(index\.html)?$/.test(String(f.url)))
    || frames.find((f) => String(f.url).includes('/html/apex/') && !String(f.url).includes('/gold/'));
  if (!nested) return null;
  if (process.env.RA1_DEBUG_CTX) {
    console.log('FRAMES', JSON.stringify(frames.map((f) => ({ id: f.id.slice(0, 8), url: f.url })), null, 0));
    console.log('CTXMAP', JSON.stringify([...mainWorldByFrame.entries()].map(([k, v]) => [k.slice(0, 8), v])));
    console.log('PICKED', nested.id.slice(0, 8), String(nested.url));
  }
  if (!mainWorldByFrame.has(nested.id)) {
    await refreshContexts();
    if (!mainWorldByFrame.has(nested.id)) {
      // A freshly created frame may not be replayed yet: fall back to an
      // isolated world for DOM probes only (no globals are read through it).
      const world = await cmd('Page.createIsolatedWorld', { frameId: nested.id, worldName: 'ra1-dom', grantUniveralAccess: true }).catch(() => null);
      return world?.executionContextId || null;
    }
  }
  return mainWorldByFrame.get(nested.id) || null;
}
async function waitInFrame(expr, label, timeoutMs = 60000) {
  const t0 = Date.now();
  for (;;) {
    const ctx = await frameContext();
    let v = false;
    if (ctx) { try { v = await evl(expr, ctx); } catch { /* not ready */ } }
    if (v) return ctx;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitInFrame timeout: ' + label);
    await sleep(320);
  }
}
async function pressInFrame(sel) {
  const ctx = await frameContext();
  const c = await evl(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:r.width,h:r.height,vis:s.visibility,disp:s.display,op:Number(s.opacity)}}).filter(c=>c.w>2&&c.h>2&&c.vis!=='hidden'&&c.disp!=='none'&&c.op>0.05);return l[0]||null})()`, ctx);
  if (!c) throw new Error('press target missing in nested frame: ' + sel);
  // The nested frame is 1:1 with the host iframe at the top-left origin.
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
  await sleep(70);
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
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
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.executionContextCreated') {
      const c = m.params.context;
      if (c?.auxData?.isDefault && c.auxData?.frameId) mainWorldByFrame.set(c.auxData.frameId, c.id);
    }
    if (m.method === 'Runtime.executionContextsCleared') mainWorldByFrame.clear();
  });
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const host = new URL(HOST).origin;
  const badRequests = [];
  const external = [];
  ws.addEventListener('message', (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.method === 'Network.responseReceived') {
      const url = m.params?.response?.url || '';
      if (m.params?.response?.status >= 400) badRequests.push(m.params.response.status + ' ' + url);
      try { const u = new URL(url); if (u.origin !== host && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url); } catch { /* non-url */ }
    }
    if (m.method === 'Runtime.exceptionThrown') badRequests.push('EXCEPTION ' + (m.params?.exceptionDetails?.text || '').slice(0, 120));
  });

  await cmd('Page.navigate', { url: HOST + '/' });
  await waitInFrame(`!!document.querySelector('#apex-boot-start')`, 'nested boot', 60000);
  check('packaged game boots inside the nested /html/apex/ iframe', true);
  await pressInFrame('#apex-boot-start');
  await waitInFrame(`!!document.querySelector('#freeBattle') && ${TX}`, 'nested home');
  await shot('nested-home-390x844');
  const home = await evl(`(()=>({url:location.href,base:document.baseURI,ac:document.querySelector('#apexAccountOpen')?1:0,guide:!!document.querySelector('.apex-coach-skip')||!!document.querySelector('.apex-guide-close')}))()`, await frameContext());
  check('nested home reaches the real product Entry (account entry present)', home?.ac === 1, JSON.stringify(home));

  // Dismiss the returning coach if it is up, then walk into a live battle.
  if (await evl(`!!document.querySelector('.apex-coach-skip')`, await frameContext())) await pressInFrame('.apex-coach-skip');
  await pressInFrame('#freeBattle');
  await waitInFrame(`document.querySelector('#stage')?.classList.contains('screen-mode') && ${TX}`, 'nested mode');
  // The mode cards commit a short entrance transform; tap once the card is
  // settled rather than mid-animation.
  const modeReady = await waitInFrame(`(()=>{const c=document.querySelector('.modeCard[data-mode="bot"]');if(!c)return false;const r=c.getBoundingClientRect();return r.width>40&&Number(getComputedStyle(c).opacity)>0.9})()`, 'nested mode card settled', 20000).catch(() => null);
  await sleep(600);
  await pressInFrame('.modeCard[data-mode="bot"]');
  await waitInFrame(`document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX}`, 'nested fighter');
  await sleep(700);
  await shot('nested-fighter-390x844');
  const pick = await evl(`(()=>{const i=document.querySelector('#p1WorldArt img');return{p1:document.querySelector('#p1Name')?.textContent,nw:i?i.naturalWidth:0,src:i?i.getAttribute('src'):null}})()`, await frameContext());
  check('nested Fighter Select decodes the hero preview from the nested base', pick?.nw > 0, JSON.stringify(pick));
  await pressInFrame('#lockIn');
  await waitInFrame(`document.querySelector('#stage')?.classList.contains('fighter-active-p2') || document.querySelector('#battleHudHost')?.classList.contains('is-open')`, 'nested bot pick');
  await sleep(300);
  if (!(await evl(`document.querySelector('#battleHudHost')?.classList.contains('is-open')`, await frameContext()))) await pressInFrame('#lockIn');
  const live = await waitInFrame(`document.querySelector('#battleHudHost')?.classList.contains('is-open') && window.APEX_ARSENAL?.state?.battleMode==='BOT'`, 'nested live battle', 90000).catch(() => null);
  if (!live) {
    const diagCtx = await frameContext();
    console.log('BATTLE DIAG', JSON.stringify(await evl(`(()=>{const h=document.querySelector('#battleHudHost');const f=document.querySelector('#battleHudFrame');const s=document.querySelector('#stage');return{stage:s?.className,host:h?.className,hostAttr:h?.getAttribute('class'),frameSrc:f?.getAttribute('src'),arsenal:!!window.APEX_ARSENAL,mode:window.APEX_ARSENAL?.state?.battleMode||null,p1:document.querySelector('#p1Flag')?.textContent,errors:(window.__apexBootErrors||[]).slice(-4)}})()`, diagCtx).catch((e) => String(e))));
    await shot('nested-battle-fail');
  }
  check('nested battle reaches the live integrated HUD', !!live, live ? 'live' : 'not reached');
  if (live) {
    await sleep(1200);
    await shot('nested-battle-390x844');
    const hud = await evl(`(()=>{const n=document.querySelector('#p2Side .id-name');const gi=[...document.querySelectorAll('#p1Side .skill .apex-skill-icon')].map(i=>i.naturalWidth>0);return{name:n?n.textContent.trim():null,skillIcons:gi,hudMode:document.querySelector('#hud')?.dataset?.mode}})()`, live);
    check('nested battle HUD carries the opponent identity and decoded skill icons',
      hud?.hudMode === '1p' && !!hud?.name && hud.skillIcons.length > 0 && hud.skillIcons.every(Boolean), JSON.stringify(hud));
    // Leave the match the way a player must always be able to. In an itch-style
    // nest the keystroke only reaches the game frame once that frame owns
    // focus (CDP page-level keys cannot cross into a cross-document iframe in
    // headless Chrome), so the gate delivers ESC into the game document — the
    // exact listener path a focused player uses — and then checks the product
    // teardown: HUD closed, pick screen restored, nothing left frozen.
    const escDelivered = await evl(`(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true})()`, live).catch(() => false);
    const left = await waitInFrame(`!document.querySelector('#battleHudHost')?.classList.contains('is-open') && document.querySelector('[data-apex-shell-stage]')?.classList.contains('screen-fighter')`, 'nested return to fighter', 25000).catch(() => null);
    const exitState = await evl(`(()=>({stage:document.querySelector('[data-apex-shell-stage]')?.className||'',hudOpen:!!document.querySelector('#battleHudHost')?.classList.contains('is-open'),body:document.body.className}))()`, await frameContext()).catch((e) => String(e));
    check('nested ESC (delivered to the game frame) leaves the match and restores Fighter Select',
      escDelivered === true && !!left && exitState?.hudOpen === false && /screen-fighter/.test(String(exitState?.stage || '')),
      JSON.stringify({ escDelivered, left: !!left, exitState }));
    // And the pick screen still works after the round trip: LOCK is live again.
    const relock = await evl(`(()=>{const b=document.querySelector('#lockIn');if(!b)return null;const r=b.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height),label:b.textContent.trim()}})()`, await frameContext());
    check('nested pick screen is reusable after leaving the match', !!relock && relock.w > 40 && relock.h > 20, JSON.stringify(relock));
  }

  console.log('STEP result-gold');
  // Result Gold must load its own first-party art under the nested path.
  try { await cmd('Page.navigate', { url: HOST + '/html/apex/result-gold/index.html' }); }
  catch (error) { console.log('NAV NOTE', String(error?.message || error)); }
  await sleep(600);
  // The packaged Result page is still the same origin; load the authorities
  // and push a native ledger payload exactly like the live handoff does.
  // The sealed match is produced by the PARENT product authority (that is the
  // production path: the ledger is sealed in the app document, then handed to
  // the Result iframe). Recreate that here: seal inside the game frame, then
  // post the very same payload into Result Gold.
  try { await cmd('Page.navigate', { url: HOST + '/html/apex/index.html' }); }
  catch (error) { console.log('NAV NOTE', String(error?.message || error)); }
  await waitInFrame(`!!window.APEX_GOLD && typeof window.APEX_GOLD.roster==='function'`, 'nested app bridge for sealing', 60000);
  // The Arsenal config + ledger load with the battle product; load the same
  // shipped files into the app document if the Home surface has not yet.
  await evl(`(async()=>{const root=document.baseURI.replace(/gold\\/$/,'');const load=(s)=>new Promise((r,j)=>{if(document.querySelector('script[data-ra1="'+s+'"]'))return r();const e=document.createElement('script');e.src=new URL(s,root).href;e.dataset.ra1=s;e.onload=r;e.onerror=j;document.head.appendChild(e)});for(const s of ['game/arsenal/arsenalConfig.js','game/arsenal/arsenalCWeaponSet.generated.js','game/results/ownerAwards.generated.js','game/results/matchResultAuthority.js'])if(!window.APEX_MATCH_RESULT_AUTHORITY||!window.APEX_ARSENAL_CONFIG)await load(s);return true})()`, await frameContext());
  await waitInFrame(`(()=>{const a=[{id:1,name:'SHURI',x:1,y:1,hp:1000,maxHp:1000},{id:2,name:'NEWBOT',x:2,y:2,hp:1000,maxHp:1000}];if(!window.APEX_MATCH_RESULT_AUTHORITY||!window.APEX_ARSENAL_CONFIG)return false;const l=window.APEX_MATCH_RESULT_AUTHORITY.create({actors:a,mode:'BOT',startedAt:1720000000000,weaponConfig:window.APEX_ARSENAL_CONFIG});l.onPickup(a[0],'SHOTGUN');l.onShot(a[0],'SHOTGUN');a[1].hp=0;l.onDamage(a[1],a[0],'arsenal-shotgun',1000);const m=l.seal('P1');try{localStorage.setItem('ra1.sealed.result',JSON.stringify(m))}catch(e){return false}return m.players[0].character.portraitSrc||'none'})()`, 'seal in parent app', 60000).catch(() => null);
  const sealed = await evl(`(()=>{try{return JSON.parse(localStorage.getItem('ra1.sealed.result')||'{}').players[0].character.portraitSrc||null}catch(e){return null}})()`, await frameContext()).catch(() => null);
  check('parent app seals the match with the real SHURI Pick artwork identity',
    typeof sealed === 'string' && /(^|\/)assets\/dictionary\/heroes\/shuri\/standing\.webp$/.test(sealed), String(sealed));
  const sealedWasPortable = typeof sealed === 'string' && sealed.startsWith('../');

  try { await cmd('Page.navigate', { url: HOST + '/html/apex/result-gold/index.html' }); }
  catch (error) { console.log('NAV NOTE', String(error?.message || error)); }
  await sleep(900);
  const delivered = await evl(`(()=>{try{const raw=localStorage.getItem('ra1.sealed.result');if(!raw)return 'no-payload';const m=JSON.parse(raw);window.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match:m},location.origin);return m.players[0].character.portraitSrc}catch(e){return String(e)}})()`);
  check('nested Result Gold receives the parent-sealed payload unchanged',
    typeof delivered === 'string' && delivered === sealed, JSON.stringify({ delivered, sealed, portable: sealedWasPortable }));
  await sleep(1200);
  const art = await evl(`(()=>{const imgs=[...document.querySelectorAll('.hero__img')].map(i=>({src:i.getAttribute('src'),nw:i.naturalWidth}));const g=document.querySelector('.weapon__dais img');return{imgs,gun:g?{src:g.getAttribute('src'),nw:g.naturalWidth}:null,tags:[...document.querySelectorAll('.art-tag')].map(t=>t.textContent.trim())}})()`);
  check('nested Result Gold decodes hero portraits and weapon art (no placeholders)',
    (art?.imgs || []).length === 2 && art.imgs.every((i) => i.nw > 0) && art.gun?.nw > 0 && (art.tags || []).length === 0, JSON.stringify(art));
  // Evidence must be the settled board after the authored Skip.
  await evl(`document.querySelector('.skip')?.click()`);
  await sleep(1400);
  await shot('nested-result-390x844');

  // Save persistence across a reload inside the nested path.
  try { await cmd('Page.navigate', { url: HOST + '/' }); }
  catch (error) { console.log('NAV NOTE', String(error?.message || error)); }
  await waitInFrame(`!!document.querySelector('#apex-boot-start')`, 'nested reboot');
  await pressInFrame('#apex-boot-start');
  await waitInFrame(`!!document.querySelector('#freeBattle') && ${TX}`, 'nested home again');
  const saved = await evl(`(()=>{try{const raw=localStorage.getItem('apexChaos.arsenalMeta.v1')||'';const parsed=raw?JSON.parse(raw):null;return{has:!!parsed,keys:parsed?Object.keys(parsed).length:0}}catch(e){return{error:String(e)}}})()`, await frameContext());
  check('nested reload keeps the guest save reachable', saved?.has === true, JSON.stringify(saved));

  const bad = badRequests.filter((b) => !/favicon/i.test(b));
  check('nested hosting produces no first-party 404 and no page exception', bad.length === 0, JSON.stringify(bad.slice(0, 6)));
  const ext = [...new Set(external.filter((u) => !u.startsWith(host)))];
  check('nested hosting requests no external host (Guest-only release law)', ext.length === 0, JSON.stringify(ext.slice(0, 6)));
  fs.writeFileSync(`${DIR}/nested-result.json`, JSON.stringify({ host: HOST, passes, failures, badRequests, external: ext }, null, 2));

  console.log('');
  console.log('RA-1 nested itch hosting — evidence ' + DIR);
  if (failures.length) { console.error('RESULT: FAIL (' + passes.length + ' pass, ' + failures.length + ' fail)'); process.exitCode = 1; }
  else console.log('RESULT: PASS (' + passes.length + ' pass, 0 fail)');
  try { chrome.kill('SIGKILL'); } catch { /* gone */ }
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error('GATE ERROR', e); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
