// R91 LABEL-FIT browser gate (HUD Preservation & Defect Audit, D1/D2).
//
// Proves IN A REAL BROWSER that primary-deck skill/weapon labels are never
// elided by the production-built Battle HUD donor. Source-string gates
// cannot see elision (text-overflow clips inside the element without any
// page overflow — the historic blind spot that let D1 survive green gates),
// so this gate measures scrollWidth vs clientWidth in Chromium.
//
// Faithfulness notes:
// - Loads the PRODUCTION built artifact public/gold/battle-hud.html
//   standalone and injects the shell's fonts.css, exactly the font source
//   the production mount seam inherits (goldProductBridge.mountBattleHud
//   mounts the donor into the shell document; its CSS is scoped verbatim).
// - Worst-case production strings only (from GOLD_SKILL_COPY,
//   localeCatalog VI, arsenalConfig weapon display names).
// - PRIMARY scope = 2p both sides + 1p P1. CPU tertiary readouts in 1p
//   keep donor elision by design and are asserted UNCHANGED in class
//   (portrait 1p CPU .wp-txt stays display:none — the closed D2 law).
//
// Run: CHROME_PATH=/path/to/chrome node tools/testBattleHudLabelFitBrowser.mjs
// (LD_LIBRARY_PATH is inherited; a static server for public/ is built in.)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const failures = []; const passes = [];
function check(name, cond, extra = '') {
  (cond ? passes : failures).push((cond ? 'PASS ' : 'FAIL ') + name + extra);
  console.log((cond ? 'PASS ' : 'FAIL ') + name + extra);
}

// ---- source-level pins (fast, browser-independent) -----------------------
const build = fs.readFileSync('tools/buildGoldCutover.mjs', 'utf8');
const hud = fs.readFileSync('public/gold/battle-hud.html', 'utf8');
const adapter = fs.readFileSync('tools/goldBattleHudR91labelFit.mjs', 'utf8');
check('build imports R91 label-fit adapter', build.includes("from './goldBattleHudR91labelFit.mjs'"));
check('build chains R91 after R83',
  build.indexOf('adaptGoldBattleHudR91LabelFit(out)') > build.indexOf('adaptGoldBattleHudR83(out)'));
check('built HUD carries R91 LABEL-FIT exactly once',
  (hud.split('R91 LABEL-FIT').length - 1) === 1);
check('adapter is a duplicate-guarded stylesheet insertion (donor untouched)',
  adapter.includes("throw new Error('R91 duplicate law')") && adapter.includes("const anchor = '</style>';"));
check('adapter excludes Quest composition', adapter.includes(':not([data-quest="1"])'));

// ---- static server for public/ -------------------------------------------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  const file = path.join('public', rel);
  if (!file.startsWith('public') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const HUD_URL = `http://127.0.0.1:${server.address().port}/gold/battle-hud.html`;

// ---- chrome via CDP (same pattern as testQuestBattleHudFamilyBrowser) ----
const chromePath = process.env.CHROME_PATH || 'google-chrome';
const CDP_PORT = 9411;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(chromePath, [
  '--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-allow-origins=*', '--remote-debugging-port=' + CDP_PORT,
  '--user-data-dir=/tmp/apex-r91-labelfit-' + process.pid, 'about:blank',
], { stdio: 'ignore', env: process.env });
chrome.on('error', (e) => { console.error('CHROME LAUNCH FAILED:', e.message, '\nSet CHROME_PATH to a Chrome/Chromium binary.'); process.exit(1); });

let ws; let serial = 0; const pending = new Map();
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const to = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 25000);
    pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${CDP_PORT}${p}`); return r.json(); }
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}

const EN = { name: 'CRYSTALA', tag: 'ANCIENT CRYSTAL ENTITY', ctrl1: 'LOCAL · J K', ctrl2: 'LOCAL · NUM 1 2', rival: 'CRYSTALA', weapon: 'MOSSBERG 500', weapon17: 'PANCOR JACKHAMMER', skill1: 'MAGNETIC ATTRACTION', skill2: 'MECHANICAL GENESIS', desc: '12.0S COOLDOWN' };
const VI = { name: 'CRYSTALA', tag: 'ĐƠN VỊ ĐIỀU KHIỂN TRƯỜNG LỰC', ctrl1: 'LOCAL · J K', ctrl2: 'LOCAL · NUM 1 2', rival: 'CRYSTALA', weapon: 'MOSSBERG 500', weapon17: 'PANCOR JACKHAMMER', skill1: 'KHO VŨ KHÍ PHẢN CHIẾU', skill2: 'KIẾN TẠO THÍCH ỨNG', desc: '12.0S HỒI CHIÊU' };
const CASES = [
  { id: 'desk-1920-2p', w: 1920, h: 1080, mode: '2p' },
  { id: 'desk-1920-1p', w: 1920, h: 1080, mode: '1p' },
  { id: 'desk-1366-1p', w: 1366, h: 768, mode: '1p' },
  { id: 'land-932-2p', w: 932, h: 430, mode: '2p' },
  { id: 'land-932-1p', w: 932, h: 430, mode: '1p' },
  { id: 'land-844-1p', w: 844, h: 390, mode: '1p' },
  { id: 'port-430-2p', w: 430, h: 932, mode: '2p' },
  { id: 'port-430-1p', w: 430, h: 932, mode: '1p' },
  { id: 'port-390-1p', w: 390, h: 844, mode: '1p' },
  { id: 'port-360-2p', w: 360, h: 640, mode: '2p' },
  { id: 'port-360-1p', w: 360, h: 640, mode: '1p' },
  { id: 'porttab-820-1p', w: 820, h: 1180, mode: '1p' },
  { id: 'landtab-1180-2p', w: 1180, h: 820, mode: '2p' },
];

function measureExpr(mode, T) {
  return `(()=>{
    const hud=document.getElementById('hud'); if(!hud) return {error:'no hud'};
    try{ if(typeof S!=='undefined' && S) S.mode=${JSON.stringify(mode)}; }catch(e){}
    hud.dataset.mode=${JSON.stringify(mode)};
    const T=${JSON.stringify(T)};
    const rows=[];
    const vis=el=>{ if(!el) return false; const cs=getComputedStyle(el); return cs.display!=='none'&&cs.visibility!=='hidden'&&el.getClientRects().length>0; };
    const probe=(root,side,sel,str,key)=>{
      const el=root?root.querySelector(sel):null;
      if(!el){ rows.push({side,key,sel,missing:true}); return; }
      el.textContent=str;
      const cs=getComputedStyle(el);
      rows.push({side,key,sel,str,font:parseFloat(cs.fontSize),cw:el.clientWidth,sw:el.scrollWidth,ov:Math.max(0,el.scrollWidth-el.clientWidth),ch:el.clientHeight,sh:el.scrollHeight,visible:vis(el)});
    };
    for(const [sideId,side] of [['p1Side','P1'],['p2Side','P2']]){
      const root=document.getElementById(sideId);
      probe(root,side,'.wp-name',T.weapon17,'wp-name-17');
      // Owner-ordered ordering fix: measure the weapon BLOCK while the
      // longest (17ch) name is still displayed — previously wp-block was
      // only measured after the name had been replaced by the 12ch string,
      // so a 17ch-driven block overflow could hide. The 12ch-state block
      // measurement below is kept as the second sample.
      const wpb17=root?root.querySelector('.weapon'):null;
      if(wpb17) rows.push({side,key:'wp-block-17',tileOv:wpb17.scrollHeight-wpb17.clientHeight,visible:vis(wpb17)});
      probe(root,side,'.wp-name',T.weapon,'wp-name');
      const wt=root?root.querySelector('.wp-txt'):null;
      rows.push({side,key:'wp-txt-wrap',visible:vis(wt),disp:wt?getComputedStyle(wt).display:'missing'});
      const wpb=root?root.querySelector('.weapon'):null;
      if(wpb) rows.push({side,key:'wp-block',tileOv:wpb.scrollHeight-wpb.clientHeight,visible:vis(wpb)});
      const skills=root?[...root.querySelectorAll('.skill')]:[];
      skills.forEach((sk,i)=>{
        probe(sk,side,'.sk-name',i===0?T.skill1:T.skill2,'sk-name-'+(i+1));
        probe(sk,side,'.sk-desc',T.desc,'sk-desc-'+(i+1));
        rows.push({side,key:'tile-'+(i+1),tileOv:sk.scrollHeight-sk.clientHeight,visible:vis(sk)});
      });
    }
    return { ds:{...hud.dataset}, rows };
  })()`;
}

try {
  for (let i = 0; i < 80; i++) { try { await httpJson('/json/version'); break; } catch { await sleep(300); if (i === 79) throw new Error('devtools never came up (CHROME_PATH=' + chromePath + ')'); } }
  const targets = await httpJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: HUD_URL });
  await sleep(1400);
  const fonts = await evl(`(async()=>{
    const l=document.createElement('link'); l.rel='stylesheet'; l.href='fonts.css'; document.head.appendChild(l);
    const out={};
    for(const [f,t] of [['800 20px Oswald','MAGNETIC ATTRACTION'],['800 20px Oswald','ĐƠN VỊ KIẾN TẠO Ấ'],['700 20px Teko','02:47'],['400 12px "JetBrains Mono"','LOCAL']]){
      try{ await document.fonts.load(f,t); out[f]=document.fonts.check(f,t); }catch(e){ out[f]=false; }
    }
    await document.fonts.ready; await new Promise(r=>setTimeout(r,250));
    return out;
  })()`);
  check('shell fonts load in HUD (EN+VI Oswald, Teko, JetBrains Mono)', Object.values(fonts).every(Boolean), ' :: ' + JSON.stringify(fonts));
  const boot = await evl(`(()=>!!document.getElementById('hud')&&!!document.getElementById('p1Side')&&!!document.getElementById('p2Side'))()`);
  check('built HUD boots standalone with both sides', boot === true);

  let maxTileOv = 0; let probeCount = 0; const tileOffenders = [];
  for (const c of CASES) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: c.w, height: c.h, deviceScaleFactor: 1, mobile: false });
    await sleep(420);
    for (const [lang, T] of [['EN', EN], ['VI', VI]]) {
      const res = await evl(measureExpr(c.mode, T));
      if (!res || res.error) { check(`${c.id} ${lang} measurement ran`, false, ' :: ' + JSON.stringify(res)); continue; }
      for (const r of res.rows) {
        if (r.tileOv != null) { maxTileOv = Math.max(maxTileOv, r.tileOv); if (r.tileOv > 8) tileOffenders.push(`${c.id} ${lang} ${r.side} ${r.key} tileOv=${r.tileOv}`); }
        const primary = c.mode === '2p' || r.side === 'P1';
        if (!primary || !/^(sk-name|wp-name)/.test(r.key || '') || !r.visible) continue;
        probeCount++;
        const vertClamp = (r.sh != null && r.ch != null) ? r.sh - r.ch : 0;
        check(`${c.id} ${lang} ${r.side} ${r.key} fits ("${r.str}")`, r.ov <= 1 && vertClamp <= 4,
          ` :: cw=${r.cw} sw=${r.sw} ov=${r.ov} vClamp=${vertClamp} font=${r.font}`);
      }
      if (c.id === 'port-390-1p' && lang === 'EN') {
        const wrap = res.rows.find((r) => r.key === 'wp-txt-wrap' && r.side === 'P2');
        check('D2 law intact: portrait 1p CPU .wp-txt stays display:none', !!wrap && wrap.disp === 'none', ' :: ' + JSON.stringify(wrap));
      }
    }
  }
  check(`primary-deck probes actually measured (${probeCount})`, probeCount >= 100);
  // The rejected desk-wrap failure mode measured +22px of tile overflow;
  // anything beyond an 8px tolerance is layout breakage, not rounding.
  check('no skill/weapon tile internal overflow beyond tolerance', maxTileOv <= 8, ` :: maxTileOv=${maxTileOv}${tileOffenders.length ? ' :: ' + [...new Set(tileOffenders)].join('; ') : ''}`);
} finally {
  try { ws && ws.close(); } catch {}
  try { chrome.kill('SIGKILL'); } catch {}
  server.close();
}

console.log(`\nRESULT: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${passes.length} pass, ${failures.length} fail)`);
if (failures.length) process.exitCode = 1;
