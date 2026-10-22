// RA-1.B — Tutorial input truth, pause lease, resume, SKIP and recovery.
//
// Owner-reported risk: a phone lesson teaching "Press J" while the player
// only has touch. This gate drives the REAL integrated app and the REAL
// coach, not a fixture:
//   A  touch session (CDP touch input): lesson names the HUD card, pause
//      lease freezes the clock, tapping the taught card resumes once and
//      advances the step.
//   B  hybrid session: the page LIES about (pointer: coarse) (a paired mouse
//      makes the primary pointer fine) and the player still touches. Copy
//      must follow the observed input, not the boot-time media query.
//   C  keyboard session: lesson teaches J, the J key resumes and advances.
//   D  SKIP ends the coach with no pause lease left behind.
//   E  pagehide recovery releases a held pause lease (a backgrounded tab can
//      never leave the match frozen).
//
// Harness: house CDP pattern (dev server via APEX_APP_URL, CHROME_PATH).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173/';
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
    await sleep(300);
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
const CHIP = `(()=>{ const c=document.querySelector('.apex-coach-chip'); const layer=document.querySelector('.apex-guide-dock'); return c?{body:document.querySelector('.apex-guide-body')?.textContent||'',kicker:document.querySelector('.apex-guide-kicker')?.textContent||'',pause:!!window.APEX_TUTORIAL_PAUSE?.active,pausedAttr:layer?layer.getAttribute('data-tutorial-paused'):null,bodyClass:document.body.classList.contains('apex-tutorial-paused'),chipRect:(()=>{const r=c.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}})()}:null; })()`;
const CLOCK = `(()=>{const s=window.APEX_ARSENAL?.state; return s?{time:Number(s.time)||0,over:!!s.over}:null})()`;

async function boot(lang = 'eng', touch = true, lieAboutPointer = false) {
  await cmd('Page.navigate', { url: 'about:blank' });
  await sleep(250);
  await cmd('Page.enable'); await cmd('Runtime.enable');
  if (lieAboutPointer) {
    // A phone with a paired mouse: the primary pointer reads fine even
    // though the human is touching. Reproduces the owner's risk class.
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
  await sleep(500);
  await evl(`window.APEX_I18N && window.APEX_I18N.setLanguage(${JSON.stringify(lang)})`);
}
async function toBattle(touch) {
  const tapOrClick = async (sel) => { if (touch) await tapSel(sel); else await evl(`document.querySelector(${JSON.stringify(sel)}).click()`); };
  await tapOrClick('#freeBattle');
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-mode') && ${TX_IDLE}`, 'mode screen');
  await sleep(500);
  await tapOrClick('.modeCard[data-mode="bot"]');
  await waitFor(`document.querySelector('#stage')?.classList.contains('screen-fighter') && ${TX_IDLE}`, 'fighter select');
  await sleep(600);
  await tapOrClick('#lockIn');
  await waitFor(`document.querySelector('#stage')?.classList.contains('fighter-active-p2')`, 'BOT pick turn', 30000);
  await tapOrClick('#lockIn');
  await waitFor(`document.querySelector('#battleHudHost')?.classList.contains('is-open') && !!document.querySelector('#p1Side .skill')`, 'live battle HUD');
}
async function waitLesson(slot) {
  const expr = `(()=>{const c=document.querySelector('.apex-coach-chip'); if(!c) return false; const k=document.querySelector('.apex-guide-kicker')?.textContent||''; const layer=document.querySelector('.apex-guide-dock'); return k.includes('/6') && !!layer && layer.getAttribute('data-tutorial-paused')==='true' && !!window.APEX_TUTORIAL_PAUSE?.active;})()`;
  const timeoutMs = 150000;
  try {
    await waitFor(expr, 'paused lesson', timeoutMs);
  } catch (error) {
    const diag = await evl(`(()=>{const c=document.querySelector('.apex-coach-chip');const s=window.APEX_ARSENAL?.state;return{chip:c?c.innerText.split('\\n').join(' | '):null,lease:window.APEX_TUTORIAL_PAUSE||null,mode:s?.battleMode,time:s?.time,over:s?.over,live:(window.fighters||[]).map(f=>({hp:f.hp})),hud:document.querySelector('#hud')?.dataset.mode}})()`);
    console.log('LESSON DIAG', JSON.stringify(diag));
    throw error;
  }
}

const settle = async () => { await sleep(400); return evl(CHIP); };

async function scenarioTouch() {
  await viewport(390, 844, true);
  await boot('eng', true, false);
  await toBattle(true);
  await waitLesson(0);
  const lesson = await settle();
  check('A touch lesson names the HUD card, never a keyboard key',
    /Tap Skill 1 now\./.test(lesson.body) && !/Press J|Nhấn J/.test(lesson.body), lesson.body);
  check('A touch lesson holds the pause lease and the paused presentation',
    lesson.pause === true && lesson.pausedAttr === 'true' && lesson.bodyClass === true, JSON.stringify(lesson));
  const c1 = await evl(CLOCK); await sleep(700); const c2 = await evl(CLOCK);
  check('A paused lesson freezes the match clock', !!c1 && !!c2 && Math.abs(c2.time - c1.time) < 0.05, `${c1?.time} -> ${c2?.time}`);
  await shot('A-touch-lesson-390x844');
  await tapSel('#p1Side .skill[data-i="0"]');
  const after = await waitFor(`!window.APEX_TUTORIAL_PAUSE?.active`, 'lease released after tap', 8000).catch(() => false);
  check('A tapping the taught card releases the pause lease', after === true);
  const castForwarded = await waitFor(`(()=>{const s=document.querySelector('#p1Side .skill[data-i="0"]');const st=s?.dataset?.state;return !!st && st!=='ready';})()`, 'skill 1 entered its real cast state', 8000).catch(() => false);
  check('A the taught tap is forwarded once into the real skill 1 cast', castForwarded === true,
    await evl(`document.querySelector('#p1Side .skill[data-i="0"]')?.dataset?.state || 'unknown'`));
  await sleep(600);
  const c3 = await evl(CLOCK); await sleep(700); const c4 = await evl(CLOCK);
  check('A the match resumes running after the lesson', !!c3 && !!c4 && (c4.time - c3.time) > 0.3, `${c3?.time} -> ${c4?.time}`);
  // The skill-2 lesson is offered next; its paused chip is the SKIP surface.
  await waitLesson(1);
  const second = await settle();
  check('A the touched cast advances the coach to the skill 2 lesson', /5\/6/.test(second.kicker), second.kicker);
  check('A the skill 2 lesson offers SKIP while it holds the lease',
    !!(await evl(`!!document.querySelector('.apex-coach-skip')`)) && second.pause === true && second.pausedAttr === 'true', JSON.stringify({ pause: second.pause, pausedAttr: second.pausedAttr }));
  await shot('A-touch-lesson2-390x844');
  await tapSel('.apex-coach-skip');
  await sleep(600);
  const skipped = await evl(`(()=>{const raw=JSON.parse(localStorage.getItem('apex.alpha.coach.v2')||'{}');return{done:raw.done===true,skip:raw.skipped===true,chip:!!document.querySelector('.apex-coach-chip'),lease:!!window.APEX_TUTORIAL_PAUSE?.active,bodyClass:document.body.classList.contains('apex-tutorial-paused')}})()`);
  check('A SKIP ends the coach with no pause lease left behind',
    skipped.done === true && skipped.skip === true && skipped.chip === false && skipped.lease === false && skipped.bodyClass === false, JSON.stringify(skipped));
}

async function scenarioHybrid() {
  await viewport(390, 844, true);
  await boot('vie', true, true);
  await toBattle(true);
  await waitLesson(0);
  const media = await evl(`({coarse:matchMedia('(pointer: coarse)').matches})`);
  await evl(`(()=>{const c=JSON.parse(localStorage.getItem('apex.alpha.coach.v2')||'{}');window.__ra1coach=c})()`);
  const lesson = await settle();
  check('B the hybrid page really reports a fine (non-coarse) pointer', media.coarse === false, JSON.stringify(media));
  check('B observed touch wins over the lying media query (VIE copy)',
    /Chạm thẻ Kỹ năng 1 ngay/.test(lesson.body) && !/Nhấn J/.test(lesson.body), lesson.body);
  await shot('B-hybrid-lesson-390x844-vie');
  // Recovery: a backgrounded page must never leave the match frozen.
  // pagehide dispatch is synchronous: if the listener is attached, the lease
  // is already released in the same task (a later read could race the coach
  // legitimately offering the same lesson again).
  const recovered = await evl(`(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));return{lease:!!window.APEX_TUTORIAL_PAUSE?.active}})()`);
  check('E pagehide recovery releases the gameplay pause lease synchronously', recovered.lease === false, JSON.stringify(recovered));
  // After a return the coach may honestly re-offer the same lesson; what must
  // never happen is an unescapable freeze. Either the match is running again
  // or the re-offered lesson exposes SKIP.
  const t1 = await evl(CLOCK); await sleep(900); const t2 = await evl(CLOCK);
  const escape = await evl(`(()=>{const c=document.querySelector('.apex-coach-chip');return{lease:!!window.APEX_TUTORIAL_PAUSE?.active,skip:!!document.querySelector('.apex-coach-skip'),presentationPaused:document.body.classList.contains('apex-tutorial-paused')}})()`);
  const clockRunning = !!t1 && !!t2 && (t2.time - t1.time) > 0.3;
  check('E recovery never leaves an unescapable freeze',
    clockRunning === true || (escape.lease === true && escape.skip === true),
    JSON.stringify({ clockRunning, from: t1?.time, to: t2?.time, ...escape }));
}

async function scenarioKeyboard() {
  await viewport(1280, 800, false);
  await boot('eng', false, false);
  await toBattle(false);
  await waitLesson(0);
  const lesson = await settle();
  check('C keyboard lesson teaches the J key', /Press J now\./.test(lesson.body) && !/Tap Skill 1/.test(lesson.body), lesson.body);
  await shot('C-keyboard-lesson-1280x800');
  await key('KeyJ', 'j', 74);
  const released = await waitFor(`!window.APEX_TUTORIAL_PAUSE?.active`, 'keyboard lease release', 8000).catch(() => false);
  check('C the taught J key releases the pause lease', released === true);
  const advanced = await waitFor(`(()=>{const k=document.querySelector('.apex-guide-kicker')?.textContent||'';return k.includes('5/6')})()`, 'skill-2 lesson after the J cast', 15000).catch(() => false);
  const next = await evl(CHIP);
  check('C the J cast advances the coach to skill 2', advanced === true && !!next && /5\/6/.test(next.kicker), next?.kicker || 'no chip');
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

  console.log('');
  console.log('RA-1 tutorial input gate — evidence dir ' + SHOTDIR);
  if (failures.length) { console.error('RESULT: FAIL (' + passes.length + ' pass, ' + failures.length + ' fail)'); process.exitCode = 1; }
  else console.log('RESULT: PASS (' + passes.length + ' pass, 0 fail)');
  try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
  process.exit(process.exitCode || 0);
}
main().catch((error) => { console.error('GATE ERROR', error); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
