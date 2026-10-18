// Battle HUD skill-truth — production browser regression gate.
//
// Owner defect under test: the Gold skill tile said READY while the skill
// authority (abilityController.tryCast) still rejected the cast on cooldown.
// Root cause chain (proven live, r8): cdLeft-authoritative skills own no
// charge pool (ct.skills[slot].charges is undefined), the bridge projection
// turned that into a permanent fabricated charge, and the Gold renderer law
// is charges>0 -> READY. The fix reports castability as the charge count
// for single-charge skills (charges = nextIn>0 ? 0 : 1) in BOTH production
// projections (goldProductBridge.skillTruthFor + Quest companion).
//
// This gate proves the HUD now tells the authority's truth for all three
// skill kinds, in the real hosted Gold Shell battle:
//   A. duration skill (ROBOT A2, real KeyK cast): ACTIVE while the window
//      runs, then COOLDOWN (never READY) while cooldownLeft>0, tryCast
//      rejects with 'cooldown', READY returns exactly when the cooldown
//      expires and the recast succeeds.
//   B. plain cooldown skill (ROBOT A1, authority-armed via setCooldown —
//      its real cast needs a weapon the gate does not fetch): tile flips
//      cd -> ready with the authority value.
//   C. charge skill (HUNTER A1, 3 charges, real casts with the fighter
//      repositioned between snares): READY · n/3 while a charge is in hand
//      AND casts succeed; at 0 charges the tile is cd and tryCast rejects
//      with 'cooldown'; recharge restores READY · 1/3.
//
// Time law: headless game-time ticks slower than wall time, so the gate
// fast-forwards through the authority's own APIs (setCooldown /
// rechargeLeft) instead of sleeping out full cooldowns. Casts themselves
// are always real (keyboard or tryCast — the single executor path).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9441);
const SHOTDIR = process.env.SHOTDIR || '/tmp/apex-skill-hud-truth-gate';
fs.mkdirSync(SHOTDIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push(name);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT,
  '--window-size=1366,768',
  '--user-data-dir=/tmp/apex-skilltruth-gate-' + process.pid, 'about:blank',
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
async function key(code, keyName, vk) {
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: vk, code, key: keyName });
  await sleep(60);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: vk, code, key: keyName });
}
const TX_IDLE = `!document.body.classList.contains('apex-scene-transition-active')`;

async function boot() {
  try {
    await cmd('Storage.clearDataForOrigin', { origin: new URL(APP).origin, storageTypes: 'local_storage,session_storage,indexeddb,service_workers,cache_storage' });
  } catch {}
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await cmd('Page.navigate', { url: APP });
      await waitFor(`!!document.getElementById('apex-boot-start')`, 'boot start', 35000);
      break;
    } catch (e) { if (attempt === 1) throw e; }
  }
  await evl(`(()=>{ document.getElementById('apex-boot-start').click(); return true; })()`);
  await waitFor(`!!document.getElementById('freeBattle') && ${TX_IDLE}`, 'home ready');
}
async function pickVerified(hero, side) {
  // selectHero is inert until the fighter screen commits (~360ms after the
  // mode card). Click against the identity zone until it owns the hero.
  for (let i = 0; i < 10; i++) {
    await evl(`(()=>{ document.querySelector('button.rosterCard[data-hero="${hero}"]')?.click(); return true; })()`);
    await sleep(450);
    const got = await evl(`document.getElementById('p${side}Side')?.getAttribute('data-hero')`);
    if (got === hero) return true;
  }
  return false;
}
async function toBattle(p1Hero, p2Hero) {
  await evl(`(()=>{ document.getElementById('freeBattle').click(); return true; })()`);
  await waitFor(`document.querySelectorAll('.modeCard').length>=2 && ${TX_IDLE}`, 'mode ready');
  await evl(`(()=>{ [...document.querySelectorAll('.modeCard')].find(c=>/SOLO/.test(c.textContent)).click(); return true; })()`);
  await waitFor(`!!document.querySelector('button.rosterCard') && ${TX_IDLE}`, 'pick ready');
  if (!await pickVerified(p1Hero, 1)) throw new Error('P1 pick failed: ' + p1Hero);
  await evl(`(()=>{ document.getElementById('lockIn').click(); return true; })()`);
  await waitFor(`(document.getElementById('stage')?.className||'').includes('fighter-active-p2')`, 'P2 phase', 25000);
  if (!await pickVerified(p2Hero, 2)) throw new Error('P2 pick failed: ' + p2Hero);
  await evl(`(()=>{ document.getElementById('lockIn').click(); return true; })()`);
  await waitFor(`document.getElementById('hud')?.dataset.mode==='1p' && !!window.fighters?.[0]?.__hrCombatant`, 'battle live', 65000);
  await sleep(2500);
  await evl(INSTALL_PROBE);
}
const INSTALL_PROBE = `(()=>{
  window.__tile=(p,k)=>{ const hudEl=document.getElementById('hud'); const d=(hudEl&&hudEl.contentDocument)||document;
    const el=d.querySelector('.skill[data-p="'+p+'"][data-i="'+k+'"]');
    return el?{st:el.dataset.state,kind:el.dataset.kind,txt:el.querySelector('.sk-state')?.textContent}:null; };
  window.__ct=()=>window.APEX_HERO_REWORK.byCombatant(window.fighters[0]);
  window.__ctl=()=>window.APEX_HERO_REWORK.abilityController(window.__ct());
  window.__castRetry=async(slot,maxMs=9000)=>{ const ctl=window.__ctl(); const t0=Date.now(); let r=null;
    while(Date.now()-t0<maxMs){ r=ctl.tryCast(slot,{source:'gate'}); if(r.ok||r.reason!=='cc') return r;
      await new Promise(res=>setTimeout(res,400)); } return r; };
  return true;
})()`;
const PROBE = (slot, k) => `(()=>{ const ctl=window.__ctl(); const x=window.__ct().skills['${slot}'];
  return { tile: window.__tile(1,${k}), cdL:+ctl.cooldownLeft('${slot}').toFixed(2),
    charges:(x.charges===undefined?null:x.charges), rech:+x.rechargeLeft.toFixed(2) }; })()`;
async function waitTile(slot, k, pred, label, timeoutMs = 30000) {
  const t0 = Date.now();
  for (;;) {
    const p = await evl(PROBE(slot, k)).catch(() => null);
    if (p && pred(p)) return p;
    if (Date.now() - t0 > timeoutMs) return p;
    await sleep(400);
  }
}

try {
  for (let i = 0; i < 50 && !ws; i++) {
    try {
      const targets = await httpJson('/json/list');
      const t = targets.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) ws = new WebSocket(t.webSocketDebuggerUrl);
    } catch {}
    if (!ws) await sleep(400);
  }
  if (!ws) throw new Error('no CDP target');
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data);
    if (j.id && pending.has(j.id)) {
      const p = pending.get(j.id); pending.delete(j.id);
      if (j.error) p.reject(new Error(JSON.stringify(j.error))); else p.resolve(j.result);
    }
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });

  // ── A+B: ROBOT — duration A2 real cast, plain-CD A1 authority-armed ──────
  await boot();
  await toBattle('newbot', 'boxe');
  let p = await evl(PROBE('A2', 1));
  check('A baseline: A2 tile READY at cooldownLeft 0', p.tile?.st === 'ready' && p.cdL === 0, JSON.stringify(p));
  // Real keyboard cast, retried like a player would: a press can land inside
  // a BOT hard-CC or before input unlock and be legitimately rejected.
  p = null;
  for (let i = 0; i < 5 && !(p && (p.tile?.st === 'active' || p.cdL > 1)); i++) {
    await key('KeyK', 'k', 75);
    p = await waitTile('A2', 1, (v) => v.tile?.st === 'active' && v.cdL > 1, 'A2 active try ' + i, 5000);
  }
  check('A real KeyK cast: tile ACTIVE while the window runs (cooldown ticking underneath)',
    p && p.tile?.st === 'active' && /^ACTIVE/.test(p.tile?.txt || '') && p.cdL > 1,
    JSON.stringify(p));
  p = await waitTile('A2', 1, (v) => v.tile?.st === 'cd', 'A2 post-active cd', 25000);
  check('A post-ACTIVE: tile is COOLDOWN, never READY, while cooldownLeft>0 (the r8 lie)',
    p && p.tile?.st === 'cd' && /^COOLDOWN/.test(p.tile?.txt || '') && p.cdL > 1,
    JSON.stringify(p));
  await shot('A-robot-A2-cooldown');
  let r = await evl(`(async()=>await window.__castRetry('A2'))()`);
  check('A authority agrees: recast during tile-COOLDOWN rejects with reason cooldown',
    r && r.ok === false && r.reason === 'cooldown', JSON.stringify(r));
  await evl(`(()=>{ window.__ctl().setCooldown('A2',0.25); return true; })()`);
  p = await waitTile('A2', 1, (v) => v.tile?.st === 'ready' && v.cdL === 0, 'A2 ready again');
  check('A tile returns to READY exactly when the cooldown expires',
    p && p.tile?.st === 'ready' && p.cdL === 0, JSON.stringify(p));
  r = await evl(`(async()=>await window.__castRetry('A2'))()`);
  check('A recast succeeds at tile-READY', r && r.ok === true, JSON.stringify(r));

  await evl(`(()=>{ window.__ctl().setCooldown('A1',6); return true; })()`);
  p = await waitTile('A1', 0, (v) => v.tile?.st === 'cd', 'A1 armed cd', 15000);
  check('B plain-CD kind: authority-armed cooldown shows COOLDOWN (charges never fabricated)',
    p && p.tile?.kind === 'cooldown' && p.tile?.st === 'cd' && /^COOLDOWN/.test(p.tile?.txt || '') && p.cdL > 1,
    JSON.stringify(p));
  await evl(`(()=>{ window.__ctl().setCooldown('A1',0); return true; })()`);
  p = await waitTile('A1', 0, (v) => v.tile?.st === 'ready' && v.cdL === 0, 'A1 ready', 15000);
  check('B plain-CD kind: READY returns at cooldownLeft 0', p && p.tile?.st === 'ready' && p.cdL === 0, JSON.stringify(p));

  // ── C: HUNTER — charge skill (3 charges, 6.5s recharge) ─────────────────
  await boot();
  await toBattle('hunter', 'boxe');
  p = await evl(PROBE('A1', 0));
  check('C baseline: tile READY · 3/3 with three real charges',
    p.tile?.kind === 'charges' && p.tile?.txt === 'READY · 3/3' && p.charges === 3, JSON.stringify(p));
  // Spending a charge must out-wait transient rejects: hard CC from the BOT
  // and the snare's own canCast (previous deploy animation still running —
  // hunterReady). Both clear with time; 'cooldown' while charges remain
  // would be the authority lying, so it aborts the spend.
  const SPEND = `(async()=>{ const ctl=window.__ctl(); const t0=Date.now(); let r=null;
    while(Date.now()-t0<45000){ r=ctl.tryCast('A1',{source:'gate'});
      if(r.ok||r.reason==='cooldown') return r;
      await new Promise(res=>setTimeout(res,600)); } return r; })()`;
  r = await evl(SPEND);
  p = await waitTile('A1', 0, (v) => v.charges === 2 && v.tile?.st === 'ready', 'hunter 2 charges', 20000);
  check('C one cast spent: READY · 2/3 (a charge in hand stays READY while the next recharges)',
    r?.ok === true && p && p.tile?.st === 'ready' && /^READY · 2\/3/.test(p.tile?.txt || '') && p.cdL === 0,
    JSON.stringify(p));
  await shot('C-hunter-charges-2of3');
  // Snares cannot stack on one spot (mechanic condition): step sideways.
  await evl(`(()=>{ window.fighters[0].x += 220; return true; })()`);
  r = await evl(SPEND);
  await evl(`(()=>{ window.fighters[0].x -= 440; return true; })()`);
  const r3 = await evl(SPEND);
  // Hold the 0-charge instant still (recharge of charge #1 is already
  // running): re-arming rechargeLeft is a time-hold on authority state so
  // the presentation of "0 charges" can be asserted deterministically.
  await evl(`(()=>{ const x=window.__ct().skills.A1; if(x.charges===0) x.rechargeLeft = 6.5; return x.charges; })()`);
  p = await waitTile('A1', 0, (v) => v.charges === 0 && v.tile?.st === 'cd', 'hunter 0 charges cd', 20000);
  check('C all charges spent: tile COOLDOWN at 0 charges',
    r?.ok === true && r3?.ok === true && p && p.charges === 0 && p.tile?.st === 'cd' && p.cdL > 0.5,
    JSON.stringify({ r, r3, p }));
  r = await evl(`(async()=>await window.__castRetry('A1'))()`);
  check('C authority agrees: cast at 0 charges rejects with reason cooldown',
    r && r.ok === false && r.reason === 'cooldown', JSON.stringify(r));
  await evl(`(()=>{ window.__ct().skills.A1.rechargeLeft = 0.05; return true; })()`);
  // The cd->ready transition shows a 720ms READY AGAIN beat first; wait for
  // the steady charge readout.
  p = await waitTile('A1', 0, (v) => v.charges === 1 && /^READY · 1\/3/.test(v.tile?.txt || ''), 'hunter recharge', 20000);
  check('C recharge restores READY · 1/3 and the charge is real',
    p && p.charges === 1 && /^READY · 1\/3/.test(p.tile?.txt || ''), JSON.stringify(p));

  console.log(`\nRESULT: ${failures.length ? 'FAIL' : 'PASS'} (${passes.length} pass, ${failures.length} fail)`);
  process.exitCode = failures.length ? 1 : 0;
} finally {
  try { ws && ws.close(); } catch {}
  try { chrome.kill('SIGKILL'); } catch {}
}
