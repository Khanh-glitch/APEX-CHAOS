// RA-1 final evidence: real integrated BOT HUD identity/HP geometry.
// Runs through the production selection bridge, then measures the rendered
// P2 identity against the live HP bar for HUNTER, NEWBOT, and CRYSTALA.
// This is QA-only: it does not edit source, persistent saves, or match rules.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const BIN = process.env.CHROME_PATH;
const PORT = Number(process.env.CDP_PORT || 9450);
const DIR = process.env.APEX_EVIDENCE_DIR || 'docs/acceptance/ra1/hud-identities';
if (!BIN) throw new Error('CHROME_PATH is required');
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cases = [
  { width: 390, height: 844, opponent: 'hunter', language: 'eng' },
  { width: 390, height: 844, opponent: 'newbot', language: 'eng' },
  { width: 390, height: 844, opponent: 'crystala', language: 'vie' },
  { width: 844, height: 390, opponent: 'hunter', language: 'eng' },
  { width: 844, height: 390, opponent: 'newbot', language: 'eng' },
  { width: 844, height: 390, opponent: 'crystala', language: 'vie' },
  { width: 320, height: 568, opponent: 'hunter', language: 'eng' },
  { width: 320, height: 568, opponent: 'newbot', language: 'eng' },
  { width: 320, height: 568, opponent: 'crystala', language: 'vie' },
];

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--window-size=900,900',
  '--user-data-dir=/tmp/apex-ra1-hud-identities-' + process.pid, 'about:blank',
], { stdio: 'ignore' });
let ws;
let serial = 0;
const pending = new Map();
const rows = [];
const failures = [];
const consoleErrors = [];
const networkFailures = [];

function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(method + ' timeout'));
    }, 45000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await cmd('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result?.value;
}

async function waitFor(expression, label, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if (await evaluate(expression)) return true; } catch { /* navigation may replace the context */ }
    await sleep(250);
  }
  throw new Error('wait timeout: ' + label);
}

async function tap(selector) {
  const point = await evaluate(`(()=>{
    const candidates=[...document.querySelectorAll(${JSON.stringify(selector)})];
    const target=candidates.find((element)=>{
      const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
      return rect.width>2&&rect.height>2&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>.05;
    });
    if(!target)return null;
    const rect=target.getBoundingClientRect();
    return{x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2)};
  })()`);
  if (!point) throw new Error('visible tap target missing: ' + selector);
  await cmd('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ ...point, id: 1, radiusX: 6, radiusY: 6, force: 1 }],
  });
  await sleep(70);
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(280);
}

async function enterMode() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await tap('#freeBattle');
    try {
      await waitFor("document.querySelector('#stage')?.classList.contains('screen-mode')", 'mode', 9000);
      return;
    } catch (error) {
      const state = await evaluate(`(()=>({stage:document.querySelector('#stage')?.className||'',
        coach:!!document.querySelector('.apex-coach-skip'),free:!!document.querySelector('#freeBattle')}))()`);
      console.log('MODE INPUT RETRY', JSON.stringify({ attempt, state, error: error.message }));
      if (state.coach) await tap('.apex-coach-skip');
    }
  }
  throw new Error('mode screen did not mount after three actual touch attempts');
}

async function runCase(test) {
  const label = `${test.width}x${test.height}-${test.language}-${test.opponent}`;
  await cmd('Emulation.setDeviceMetricsOverride', {
    width: test.width, height: test.height, deviceScaleFactor: 1, mobile: true,
    screenOrientation: {
      type: test.width < test.height ? 'portraitPrimary' : 'landscapePrimary',
      angle: test.width < test.height ? 0 : 90,
    },
  });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cmd('Page.navigate', { url: APP });
  await waitFor("!!document.querySelector('#apex-boot-start')", label + ' boot');
  await sleep(450);
  await tap('#apex-boot-start');
  await waitFor("!!document.querySelector('#freeBattle')", label + ' home');
  if (await evaluate("!!document.querySelector('.apex-coach-skip')")) await tap('.apex-coach-skip');
  await waitFor("!!window.APEX_GOLD?.setBotOpponent", label + ' production BOT bridge');
  const setup = await evaluate(`(()=>{
    window.APEX_I18N?.setLanguage(${JSON.stringify(test.language)});
    if(window.APEX_ARSENAL_META)window.APEX_ARSENAL_META.canPublicSelect=()=>true;
    window.APEX_GOLD_LOCKED=()=>false;
    return window.APEX_GOLD.setBotOpponent(${JSON.stringify(test.opponent)});
  })()`);
  if (setup !== true) throw new Error('production BOT authority rejected ' + test.opponent);

  await enterMode();
  await sleep(450);
  await tap('.modeCard[data-mode="bot"]');
  await waitFor("document.querySelector('#stage')?.classList.contains('screen-fighter')", label + ' Fighter Select');
  await sleep(550);
  const playerPick = await evaluate(`(()=>{
    const card=document.querySelector('.rosterCard[data-hero="shuri"]');
    if(!card)return false;card.click();return true;
  })()`);
  if (!playerPick) throw new Error('P1 Shuri test card missing');
  await sleep(450);
  await evaluate("document.querySelector('#lockIn')?.click()");
  await sleep(650);
  await evaluate("document.querySelector('#lockIn')?.click()");
  await waitFor("document.querySelector('#battleHudHost')?.classList.contains('is-open')&&window.APEX_ARSENAL?.state?.battleMode==='BOT'", label + ' live battle', 60000);

  // Allow the first-play coach to mount; dismiss only through its own SKIP
  // control so the final screenshot shows the actual HUD, not an overlay.
  await sleep(4300);
  if (await evaluate("!!document.querySelector('.apex-coach-skip')")) {
    await tap('.apex-coach-skip');
    await waitFor("!document.querySelector('.apex-coach-skip')", label + ' coach closed', 10000);
  }
  await sleep(700);
  const metrics = await evaluate(`(()=>{
    const identity=document.querySelector('#p2Side .id-name');
    const hp=document.querySelector('#p2Rail .vr-hp');
    const duplicate=document.querySelector('#p2Rail .vr-name');
    const rect=(element)=>{
      if(!element)return null;
      const box=element.getBoundingClientRect(),style=getComputedStyle(element);
      return{x:+box.x.toFixed(2),y:+box.y.toFixed(2),right:+box.right.toFixed(2),bottom:+box.bottom.toFixed(2),
        width:+box.width.toFixed(2),height:+box.height.toFixed(2),display:style.display,visibility:style.visibility,
        fontFamily:style.fontFamily,fontSize:style.fontSize,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,
        overflow:element.scrollWidth-element.clientWidth};
    };
    const nameRect=rect(identity),hpRect=rect(hp);
    const overlap=nameRect&&hpRect?Math.max(0,Math.min(nameRect.right,hpRect.right)-Math.max(nameRect.x,hpRect.x))*
      Math.max(0,Math.min(nameRect.bottom,hpRect.bottom)-Math.max(nameRect.y,hpRect.y)):null;
    return{viewport:[innerWidth,innerHeight],language:window.APEX_I18N?.getLanguage?.()||null,
      identity:identity?.textContent.trim()||null,nameRect,hpRect,duplicateRail:rect(duplicate),overlapArea:overlap,
      battleMode:window.APEX_ARSENAL?.state?.battleMode||null};
  })()`);
  const expected = test.opponent.toUpperCase();
  const pass = metrics.identity === expected
    && metrics.nameRect?.display !== 'none'
    && metrics.nameRect?.visibility === 'visible'
    && metrics.nameRect?.overflow <= 1
    && metrics.nameRect.x >= 0 && metrics.nameRect.right <= test.width
    && metrics.nameRect.y >= 0 && metrics.nameRect.bottom <= test.height
    && metrics.hpRect?.x >= 0 && metrics.hpRect?.right <= test.width
    && metrics.overlapArea === 0
    && metrics.battleMode === 'BOT';
  const screenshot = `${test.width}x${test.height}-${test.language}-${test.opponent}.png`;
  const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(DIR, screenshot), Buffer.from(shot.data, 'base64'));
  const row = { label, expected, ...metrics, screenshot, pass };
  rows.push(row);
  console.log((pass ? 'PASS ' : 'FAIL ') + label + ' ' + JSON.stringify(row));
  if (!pass) failures.push({ label, error: 'identity/name/HP geometry assertion failed', metrics });
}

async function main() {
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        await fetch(`http://127.0.0.1:${PORT}/json/version`);
        break;
      } catch {
        if (attempt === 79) throw new Error('Chrome DevTools did not start');
        await sleep(250);
      }
    }
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const promise = pending.get(message.id);
        pending.delete(message.id);
        message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
      }
      if (message.method === 'Network.responseReceived' && message.params?.response?.status >= 400) {
        networkFailures.push({ status: message.params.response.status, url: message.params.response.url });
      }
      if (message.method === 'Network.loadingFailed' && !message.params?.canceled) {
        networkFailures.push({ error: message.params?.errorText, type: message.params?.type });
      }
    };
    await cmd('Page.enable');
    await cmd('Runtime.enable');
    await cmd('Network.enable');
    for (const test of cases) {
      try { await runCase(test); }
      catch (error) {
        failures.push({ label: `${test.width}x${test.height}-${test.language}-${test.opponent}`, error: error.message });
        console.error('CASE ERROR', test.width, test.height, test.opponent, error);
      }
    }
    const summary = {
      schema: 'ra1-live-hud-identities/v1',
      generatedAt: new Date().toISOString(),
      testedUrl: APP,
      testedCommit: process.env.RA1_TESTED_SHA || null,
      browser: process.env.CHROME_PATH,
      passes: rows.filter((row) => row.pass).length,
      failures,
      consoleErrors,
      networkFailures,
      rows,
    };
    fs.writeFileSync(path.join(DIR, 'hud-identity-matrix.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(`HUD IDENTITY RESULT: ${summary.passes}/${cases.length} pass; ${failures.length} fail`);
    if (failures.length || consoleErrors.length || networkFailures.length) process.exitCode = 1;
  } finally {
    try { ws?.close(); } catch { /* already closed */ }
    try { chrome.kill('SIGKILL'); } catch { /* already exited */ }
  }
}

main().catch((error) => {
  console.error('HUD IDENTITY GATE ERROR', error);
  process.exitCode = 1;
});
