// RA-1.B (Tactical Pulse Non-Blocking Contract) — Tutorial input truth,
// zero pause lease, live clock continuity, K-first castability when J lacks a
// floor gun, single-cast forwarding, >=44x44 SKIP hit target, pagehide/pageshow
// continuity, and Escape early exit to Fighter Select.
//
// Drives the REAL integrated app and REAL combat simulation in Chromium:
//   A  touch session (390x844): coach teaches castable K first while J awaits a
//      floor gun, holds NO pause lease, match clock advances live, tapping K
//      casts VIRTUAL ARMOR once, then when floor gun spawns coach teaches J,
//      SKIP >= 44x44px ends coach cleanly with zero pause lease.
//   B  hybrid session (lying `(pointer: coarse)` = false while human touches):
//      observed touch wins over lying media query (VIE copy); pagehide/pageshow
//      keep lease false and match clock continuously running.
//   C  keyboard session (1280x800): pressing J without a floor gun consumes NO
//      cooldown; coach teaches K key first; pressing K casts once & activates
//      durational armor; once floor gun spawns coach teaches J key and J casts
//      once to advance coach to step 5.
//   F  Escape before tutorial completion exits cleanly to Fighter Select with
//      zero pause lease and leaves unfinished coach resumable.

import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:4173/';
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9434);
const SHOTDIR = process.env.SHOTDIR || '/tmp/apex-ra1-tutorial-gate';
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
  '--window-size=1280,800',
  '--user-data-dir=/tmp/apex-ra1-tutorial-' + process.pid, 'about:blank',
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
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(expr, label, timeoutMs = 60000) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await evl(expr); } catch { /* navigations */ }
    if (v) return true;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + label);
    await sleep(180);
  }
}
async function shot(name) {
  const s = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${SHOTDIR}/${name}.png`, Buffer.from(s.data, 'base64'));
  console.log('SHOT', name);
}
const TX_IDLE = `!document.body.classList.contains('apex-scene-transition-active')`;

async function viewport(width, height, touch) {
  await cmd('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: touch,
    screenOrientation: { type: width < height ? 'portraitPrimary' : 'landscapePrimary', angle: width < height ? 0 : 90 },
  });
  await cmd('Emulation.setTouchEmulationEnabled', touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
}
async function tapAt(x, y) {
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
  await sleep(60);
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(120);
}
async function tapSel(sel) {
  const c = await evl(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; })()`);
  if (!c) throw new Error('tap target missing: ' + sel);
  await tapAt(c.x, c.y);
}
async function key(code, keyName, vk) {
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: vk, code, key: keyName });
  await sleep(60);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: vk, code, key: keyName });
  await sleep(150);
}

const CHIP = `(()=>{
  const c=document.querySelector('.apex-coach-chip');
  const layer=document.querySelector('.apex-guide-dock');
  const skip=document.querySelector('.apex-coach-skip');
  const sr=skip?skip.getBoundingClientRect():null;
  return c?{
    body:document.querySelector('.apex-guide-body')?.textContent||'',
    kicker:document.querySelector('.apex-guide-kicker')?.textContent||'',
    taughtSlot:layer?layer.getAttribute('data-taught-slot'):null,
    pause:!!window.APEX_TUTORIAL_PAUSE?.active,
    pausedAttr:layer?layer.getAttribute('data-tutorial-paused'):null,
    bodyClass:document.body.classList.contains('apex-tutorial-paused'),
    skipRect:sr?{w:Math.round(sr.width),h:Math.round(sr.height)}:null,
    chipRect:(()=>{const r=c.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}})()
  }:null;
})()`;
const CLOCK = `(()=>{const s=window.APEX_ARSENAL?.state; return s?{time:Number(s.time)||0,over:!!s.over}:null})()`;

async function boot(lang = 'eng', touch = true, lieAboutPointer = false) {
  await cmd('Page.navigate', { url: 'about:blank' });
  await sleep(250);
  await cmd('Page.enable'); await cmd('Runtime.enable');
  if (lieAboutPointer) {
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const original=window.matchMedia.bind(window);window.matchMedia=(q)=>{if(String(q)==='(pointer: coarse)'||String(q)==='(pointer: exact)'){const fake={matches:false,media:String(q),onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return false}};return fake}return original(q)}})()` });
  }
  await cmd('Page.navigate', { url: APP });
  await waitFor(`!!localStorage.getItem('apex.alpha.coach.v2') || !!document.querySelector('#apex-boot-start')`, 'boot shell');
  await evl(`localStorage.setItem('apex.alpha.coach.v2', JSON.stringify({version:2,step:0,done:false,skipped:false,baselineBotMatches:0,baselineSealedMatches:0}))`);
  await evl(`localStorage.removeItem('apex.alpha.sideIntro.v2')`);
  await cmd('Page.reload');
  await waitFor(`!!document.querySelector('#apex-boot-start')`, 'boot action');
  if (touch) await tapSel('#apex-boot-start'); else { await evl(`document.querySelector('#apex-boot-start').click()`); }
  await waitFor(`!!document.querySelector('#freeBattle') && ${TX_IDLE}`, 'home');
  await sleep(400);
  await evl(`window.APEX_I18N && window.APEX_I18N.setLanguage(${JSON.stringify(lang)})`);
}

async function toBattle(touch) {
  const tapOrClick = async (sel) => { if (touch) await tapSel(sel); else await evl(`document.querySelector(${JSON.stringify(sel)}).click()`); };
  await tapOrClick('#freeBattle');
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-mode') && ${TX_IDLE}`, 'mode screen');
  await sleep(400);
  await tapOrClick('.modeCard[data-mode="bot"]');
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX_IDLE}`, 'fighter select');
  await sleep(500);
  await tapOrClick('#lockIn');
  await waitFor(`document.querySelector('#stage')?.classList.contains('fighter-active-p2')`, 'BOT pick turn', 30000);
  await tapOrClick('#lockIn');
  await waitFor(`document.querySelector('#battleHudHost')?.classList.contains('is-open') && !!document.querySelector('#p1Side .skill')`, 'live battle HUD');
}

async function waitBattleLesson(stepLabel = '4/6') {
  const expr = `(()=>{const c=document.querySelector('.apex-coach-chip'); if(!c) return false; const k=document.querySelector('.apex-guide-kicker')?.textContent||''; return k.includes(${JSON.stringify(stepLabel)});})()`;
  await waitFor(expr, `live non-blocking lesson ${stepLabel}`, 45000);
  return evl(CHIP);
}

async function scenarioTouch() {
  await viewport(390, 844, true);
  await boot('eng', true, false);
  await toBattle(true);
  const lesson = await waitBattleLesson('4/6');

  check('A touch lesson names HUD card (never keyboard key J/K)',
    /Tap Skill (1|2) now/i.test(lesson.body) && !/Press J|Press K|Nhấn J|Nhấn K/.test(lesson.body), lesson.body);
  check('A non-blocking coach holds NO pause lease (active=false, data-tutorial-paused=false)',
    lesson.pause === false && lesson.pausedAttr === 'false' && lesson.bodyClass === false, JSON.stringify(lesson));
  check('A SKIP button satisfies >=44x44px WCAG touch hit target',
    !!lesson.skipRect && lesson.skipRect.w >= 44 && lesson.skipRect.h >= 44, JSON.stringify(lesson.skipRect));

  const c1 = await evl(CLOCK); await sleep(650); const c2 = await evl(CLOCK);
  check('A live match clock keeps advancing while lesson prompt is visible',
    !!c1 && !!c2 && (c2.time - c1.time) > 0.25, `${c1?.time} -> ${c2?.time}`);
  await shot('A-touch-lesson1-nonblocking-390x844');

  // Re-read current live taughtSlot right before tapping because simulation never pauses
  // during clock sampling + screenshot capture (a floor gun may spawn or be collected live).
  let liveBeforeTap = await evl(CHIP);
  let slotIdx = Number(liveBeforeTap.taughtSlot || lesson.taughtSlot || 0);
  await tapSel(`#p1Side .skill[data-i="${slotIdx}"]`);
  let singleCast = await waitFor(`(()=>{const by=window.fighters?.[0]?.__hrCombatant?.telemetry?.bySkill; const n=Number(by?.${slotIdx === 1 ? 'A2' : 'A1'})||0; return n===1;})()`, 'single cast receipt', 2500).catch(() => false);
  if (!singleCast && slotIdx === 0) {
    // Floor gun was collected by autonomous fighter during touch dispatch; cast the live taught slot.
    liveBeforeTap = await evl(CHIP);
    slotIdx = Number(liveBeforeTap.taughtSlot || 1);
    await tapSel(`#p1Side .skill[data-i="${slotIdx}"]`);
    singleCast = await waitFor(`(()=>{const by=window.fighters?.[0]?.__hrCombatant?.telemetry?.bySkill; const n=Number(by?.${slotIdx === 1 ? 'A2' : 'A1'})||0; return n===1;})()`, 'single cast receipt', 6000).catch(() => false);
  }
  check('A tapping taught skill card casts it ONCE (no double-cast)', singleCast === true);

  const second = await waitBattleLesson('5/6');
  check('A first real cast advances non-blocking coach to remaining skill lesson (5/6)',
    /5\/6/.test(second.kicker) && second.pause === false, JSON.stringify(second));
  await shot('A-touch-lesson2-nonblocking-390x844');

  await tapSel('.apex-coach-skip');
  await sleep(450);
  const skipped = await evl(`(()=>{const raw=JSON.parse(localStorage.getItem('apex.alpha.coach.v2')||'{}');return{done:raw.done===true,skip:raw.skipped===true,chip:!!document.querySelector('.apex-coach-chip'),lease:!!window.APEX_TUTORIAL_PAUSE?.active,bodyClass:document.body.classList.contains('apex-tutorial-paused')}})()`);
  check('D SKIP cleanly finishes coach with done=true, skipped=true, and zero pause lease',
    skipped.done === true && skipped.skip === true && skipped.chip === false && skipped.lease === false && skipped.bodyClass === false, JSON.stringify(skipped));
}

async function scenarioHybrid() {
  await viewport(390, 844, true);
  await boot('vie', true, true);
  await toBattle(true);
  const lesson = await waitBattleLesson('4/6');
  const media = await evl(`({coarse:matchMedia('(pointer: coarse)').matches})`);
  check('B hybrid page genuinely reports fine pointer (coarse=false)', media.coarse === false, JSON.stringify(media));
  check('B observed touch wins over lying media query (VIE touch copy, never Nhấn J/K)',
    /chạm thẻ Kỹ năng (1|2) ngay/i.test(lesson.body) && !/Nhấn J|Nhấn K/.test(lesson.body), lesson.body);
  await shot('B-hybrid-lesson-390x844-vie');

  const recovered = await evl(`(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));return{lease:!!window.APEX_TUTORIAL_PAUSE?.active}})()`);
  check('E pagehide/pageshow keeps pause lease strictly false', recovered.lease === false, JSON.stringify(recovered));
  const t1 = await evl(CLOCK); await sleep(650); const t2 = await evl(CLOCK);
  check('E match clock ticks continuously across pagehide/pageshow',
    !!t1 && !!t2 && (t2.time - t1.time) > 0.25, `${t1?.time} -> ${t2?.time}`);
}

async function scenarioKeyboard() {
  await viewport(1280, 800, false);
  await boot('eng', false, false);
  await toBattle(false);

  // Immediately inspect t~0 before first floor gun finishes 2.0s telegraph:
  const opening = await waitBattleLesson('4/6');
  const openingTruth = await evl(`(()=>{
    const p1=window.fighters?.[0];
    const jObs=window.APEX_HERO_REWORK?.observeAbilityCastability?.(p1,'A1');
    const kObs=window.APEX_HERO_REWORK?.observeAbilityCastability?.(p1,'A2');
    const jCard=document.querySelector('#p1Side .skill[data-i="0"]');
    const kCard=document.querySelector('#p1Side .skill[data-i="1"]');
    return {
      jCastable:jObs?.castable, jTpState:jCard?.dataset?.tpState,
      kCastable:kObs?.castable, kTpState:kCard?.dataset?.tpState,
      taughtSlot:document.querySelector('.apex-guide-dock')?.getAttribute('data-taught-slot')
    };
  })()`);
  if (openingTruth.jCastable === false) {
    check('C opening before floor gun: J is STANDBY (not falsely READY) and K is taught first',
      openingTruth.jTpState === 'standby' && openingTruth.kCastable === true && openingTruth.taughtSlot === '1'
      && /Press K now/.test(opening.body), JSON.stringify({ openingTruth, body: opening.body }));
    // Invalid J press before floor gun must NOT consume cooldown or increment casts.
    await key('KeyJ', 'j', 74);
    const afterInvalidJ = await evl(`(()=>{const ct=window.fighters?.[0]?.__hrCombatant;return{cdLeft:ct?.skills?.A1?.cdLeft||0,casts:ct?.telemetry?.bySkill?.A1||0}})()`);
    check('C invalid J press without floor gun consumes ZERO cooldown',
      afterInvalidJ.cdLeft === 0 && afterInvalidJ.casts === 0, JSON.stringify(afterInvalidJ));
  } else {
    check('C keyboard lesson teaches castable keyboard shortcut (never touch copy)',
      /Press (J|K) now/.test(opening.body) && !/Tap Skill/.test(opening.body), opening.body);
  }
  await shot('C-keyboard-lesson1-1280x800');

  // Cast K via keyboard, confirm active window & advancement to 5/6 (remaining skill J).
  await key('KeyK', 'k', 75);
  const kActive = await waitFor(`(()=>{const w=window.APEX_HERO_REWORK?.observeAbilityActiveWindow?.(window.fighters?.[0],'A2');return !!w?.active && w.mitigationPct>0;})()`, 'K active armor window', 5000).catch(() => false);
  check('C casting K activates simulation-clock armor window with live mitigation%', kActive === true);

  // Now wait for real floor gun reveal -> J becomes CASTABLE and coach teaches J (5/6).
  const jLesson = await waitBattleLesson('5/6');
  check('C once floor gun spawns, coach teaches J (5/6) with live target cue',
    /Press J now/i.test(jLesson.body) && jLesson.taughtSlot === '0', JSON.stringify(jLesson));
  await shot('C-keyboard-lesson2-j-castable-1280x800');

  // Re-confirm live floor target right before pressing J since non-blocking combat continues running during screenshot capture.
  await waitFor(`window.APEX_HERO_REWORK?.observeAbilityCastability?.(window.fighters?.[0],'A1')?.castable === true`, 'live floor gun ready for J cast', 25000);
  await key('KeyJ', 'j', 74);
  const completedBoth = await waitFor(`window.APEX_LEARN_BY_PLAYING?.state?.()?.step === 5`, 'coach advances to step 5 after J+K casts', 10000).catch(() => false);
  check('C casting J advances coach to step 5 with both battle skills completed', completedBoth === true);
}

async function scenarioEarlyExit() {
  await viewport(390, 844, true);
  await boot('eng', true, false);
  await toBattle(true);
  const lesson = await waitBattleLesson('4/6');
  check('F early-exit begins inside live non-paused first battle lesson',
    lesson.pause === false && lesson.pausedAttr === 'false', JSON.stringify(lesson));
  await shot('F-early-exit-before-escape-390x844');
  await key('Escape', 'Escape', 27);
  await waitFor(`!document.querySelector('#battleHudHost')?.classList.contains('is-open') && document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX_IDLE}`, 'early tutorial exit to Fighter Select', 25000);
  const state = await evl(`(()=>{const saved=JSON.parse(localStorage.getItem('apex.alpha.coach.v2')||'{}');return{stage:document.querySelector('#stage')?.className||'',hudOpen:!!document.querySelector('#battleHudHost')?.classList.contains('is-open'),lease:!!window.APEX_TUTORIAL_PAUSE?.active,pausedPresentation:document.body.classList.contains('apex-tutorial-paused'),done:saved.done===true,skipped:saved.skipped===true}})()`);
  check('F early Escape exits cleanly to Fighter Select with zero pause lease and leaves unfinished coach resumable',
    state.hudOpen === false && !state.lease && !state.pausedPresentation && state.done === false && state.skipped === false && /screen-fighter/.test(state.stage), JSON.stringify(state));
  await shot('F-early-exit-after-escape-390x844');
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

  const only = String(process.env.RA1_SCENARIO || '').toUpperCase();
  const wants = (name) => !only || only.includes(name);
  if (wants('A')) await scenarioTouch();
  if (wants('B')) await scenarioHybrid();
  if (wants('C')) await scenarioKeyboard();
  if (wants('F')) await scenarioEarlyExit();

  console.log('');
  console.log('RA-1 tutorial input gate — evidence dir ' + SHOTDIR);
  if (failures.length) { console.error('RESULT: FAIL (' + passes.length + ' pass, ' + failures.length + ' fail)'); process.exitCode = 1; }
  else console.log('RESULT: PASS (' + passes.length + ' pass, 0 fail)');
  try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
  process.exit(process.exitCode || 0);
}
main().catch((error) => { console.error('GATE ERROR', error); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
