// RA-1.D — BOT match duration / stalemate measurement (investigation only).
//
// The product Arsenal match ends on KO only (public/game/modes/arsenalBattleRuntime.js
// seals state.over when aqKO() is true; public/apexEngine.js endMatch() is the
// classic HP-KO path). There is no authored time limit or draw rule, and the
// HUD clock counts UP. This tool measures what that costs in practice.
//
// Method: a REAL BOT match in the real browser, with the production AI on the
// CPU side and the player side left to the same autonomous fighter state a
// player who stops input produces. The simulation is then advanced with the
// product's own APEX_ARSENAL.step(dt) — the same call the browser suite uses —
// so the match runs at accelerated wall-clock speed but identical physics,
// AI decisions, damage and cooldowns. Nothing about the match is fabricated.
//
// Output: per pairing {duration, winner, damage, hp, resolved}, plus
// median/p90/max and unresolved counts at 180 s and 300 s. NO rules are
// changed by this tool; it only measures and reports.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9439);
const DIR = process.env.APEX_EVIDENCE_DIR || '/tmp/apex-ra1-bot-duration';
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAIRS = (process.env.RA1_PAIRS || 'newbot:newbot,newbot:hunter,newbot:crystala,newbot:magnet,newbot:frost,boxe:hunter')
  .split(',').map((p) => p.split(':'));
const CAP_SECONDS = Number(process.env.RA1_CAP_SECONDS || 320);

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--window-size=390,844',
  '--user-data-dir=/tmp/apex-ra1-duration-' + process.pid, 'about:blank',
], { stdio: 'ignore' });

let ws; let serial = 0; const pending = new Map();
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const to = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 90000);
    pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(expr, label, timeoutMs = 60000) {
  const t0 = Date.now();
  for (;;) { let v = false; try { v = await evl(expr); } catch { /* nav */ } if (v) return true; if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + label); await sleep(300); }
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }
const TX = `!document.body.classList.contains('apex-scene-transition-active')`;
async function press(sel) {
  const c = await evl(`(()=>{const l=[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:r.width,h:r.height}}).filter(c=>c.w>2&&c.h>2);return l[0]||null})()`);
  if (!c) throw new Error('press target missing: ' + sel);
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
  await sleep(70);
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(350);
}

async function runMatch(p1, p2) {
  await cmd('Page.navigate', { url: APP });
  await waitFor(`!!document.querySelector('#apex-boot-start')`, 'boot');
  await sleep(700);
  await press('#apex-boot-start');
  await waitFor(`!!document.querySelector('#freeBattle') && ${TX}`, 'home');
  await evl(`window.APEX_ARSENAL_META && (window.APEX_ARSENAL_META.canPublicSelect = () => true); window.APEX_GOLD_LOCKED = () => false;`);
  await evl(`window.APEX_GOLD && window.APEX_GOLD.setBotOpponent(${JSON.stringify(p2)})`);
  await press('#freeBattle');
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-mode') && ${TX}`, 'mode');
  await press('.modeCard[data-mode="bot"]');
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX}`, 'fighter');
  await sleep(600);
  await evl(`document.querySelector('.rosterCard[data-hero=${JSON.stringify(p1)}]')?.click()`);
  await sleep(500);
  await evl(`document.querySelector('#lockIn')?.click()`);
  await sleep(700);
  await evl(`document.querySelector('#lockIn')?.click()`);
  await waitFor(`document.querySelector('#battleHudHost')?.classList.contains('is-open') && window.APEX_ARSENAL?.state?.battleMode==='BOT'`, 'live battle', 90000);
  await sleep(900);
  const started = await evl(`(()=>({time:window.APEX_ARSENAL.state.time,hp:window.fighters.map(f=>Math.round(f.hp)),mode:window.APEX_ARSENAL.state.battleMode,bot:document.querySelector('#p2Side .id-name')?.textContent||null}))()`);
  const result = await evl(`(()=>{
    const A=window.APEX_ARSENAL; const start=A.state.time; const hp0=window.fighters.map(f=>Math.round(f.hp));
    let steps=0; const cap=${CAP_SECONDS};
    while(!A.state.over && A.state.time-start<cap && steps<cap*40){ A.step(0.025); steps++; }
    const f=window.fighters;
    return {steps, start, duration:Math.round((A.state.time-start)*10)/10, over:A.state.over||null,
      hp:hp0.map((h,i)=>[h,Math.round(f[i].hp)]), winnerSide:A.state.winnerSide||null,
      clockHud:document.querySelector('#mc-time')?.textContent||document.querySelector('.mc-time')?.textContent||null};
  })()`);
  // The result, when a KO really happened, must be sealed by the product.
  const sealed = await evl(`(()=>({over:window.APEX_ARSENAL.state.over,result:!!window.APEX_ARSENAL.state.resultGold,winner:window.APEX_ARSENAL.state.winnerSide||null}))()`);
  return { p1, p2, started, ...result, sealed };
}

const fmt = (ms) => ms;
function stats(rows) {
  const done = rows.filter((r) => r.over).map((r) => r.duration).sort((a, b) => a - b);
  const median = done.length ? done[Math.floor((done.length - 1) / 2)] : null;
  const p90 = done.length ? done[Math.min(done.length - 1, Math.ceil(done.length * 0.9) - 1)] : null;
  return {
    resolved: done.length, unresolved: rows.length - done.length,
    median, p90, max: done.length ? done[done.length - 1] : null,
    unresolvedAt180: rows.filter((r) => !r.over || r.duration > 180).length,
    unresolvedAt300: rows.filter((r) => !r.over || r.duration > 300).length,
  };
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
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const rows = [];
  for (const [p1, p2] of PAIRS) {
    try {
      const row = await runMatch(p1, p2);
      rows.push(row);
      console.log('MATCH', JSON.stringify(row));
    } catch (error) {
      rows.push({ p1, p2, error: String(error.message || error) });
      console.log('MATCH ERROR', p1, p2, String(error.message || error));
    }
  }
  const summary = { generatedAt: new Date().toISOString(), capSeconds: CAP_SECONDS, rows, stats: stats(rows) };
  fs.writeFileSync(`${DIR}/bot-duration.json`, JSON.stringify(summary, null, 2));
  console.log('SUMMARY', JSON.stringify(summary.stats));
  console.log('EVIDENCE', DIR + '/bot-duration.json');
  try { chrome.kill('SIGKILL'); } catch { /* gone */ }
  process.exit(0);
}
main().catch((e) => { console.error('MEASURE ERROR', e); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
