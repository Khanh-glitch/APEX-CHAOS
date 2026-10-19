// Hosted production acceptance suite (scratch driver, evidence in /tmp/hudprobe/hosted).
// Drives the REAL app (Vite dev @5173) through Gold Shell flow into live battles,
// then per context: measure+shot raw, grant long-name weapons (measure+shot
// immediately), cast A1 and capture cooldown (re-equip first so the long
// weapon name and the running cooldown share one frame).
// v2: hero picks are VERIFIED against the pick identity zones (retrying the
// click) — v1 silently fell back to ROBOT on desktop EN. Cast is verified by
// polling the skill tile state, with a physical J-key fallback.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const APP = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const BIN = '/tmp/hudprobe/chromium';
const PORT = 9419;
const OUTDIR = '/tmp/hudprobe/hosted';
fs.mkdirSync(OUTDIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONTEXTS = [
  { id: 'desk1366-bot-en', w: 1366, h: 768, mode: 'bot', lang: 'eng', p1: 'magnet', p2: 'crystala' },
  { id: 'desk1366-bot-vi', w: 1366, h: 768, mode: 'bot', lang: 'vie', p1: 'mirror', p2: 'magnet' },
  { id: 'land932-bot-en', w: 932, h: 430, mode: 'bot', lang: 'eng', p1: 'magnet', p2: 'crystala' },
  { id: 'port390-bot-en', w: 390, h: 844, mode: 'bot', lang: 'eng', p1: 'magnet', p2: 'crystala' },
  { id: 'port390-bot-vi', w: 390, h: 844, mode: 'bot', lang: 'vie', p1: 'mirror', p2: 'crystala' },
  { id: 'port430-local-en', w: 430, h: 932, mode: 'local', lang: 'eng', p1: 'magnet', p2: 'magnet' },
];

const env = { ...process.env, LD_LIBRARY_PATH: '/tmp/hudprobe/libs/lib', FONTCONFIG_FILE: '/tmp/hudprobe/fontsx/fonts.conf', HOME: '/tmp/hudprobe' };
const chrome = spawn(BIN, [
  '--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*', '--remote-debugging-port=' + PORT,
  '--window-size=1366,768',
  '--user-data-dir=/tmp/hudprobe/profile-suite-' + process.pid, 'about:blank',
], { env, stdio: 'ignore' });

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
async function shot(name) {
  const s = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${OUTDIR}/${name}.png`, Buffer.from(s.data, 'base64'));
  console.log('  SHOT', name);
}
async function waitFor(expr, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await evl(expr); } catch {}
    if (v) return true;
    if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + label);
    await sleep(350);
  }
}
async function clickSel(sel) {
  const r = await evl(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'NOT_FOUND'; e.scrollIntoView({block:'center'}); e.click(); return 'OK'; })()`);
  if (r !== 'OK') throw new Error('click failed ' + sel + ' -> ' + r);
}
// Click a roster card and verify the pick identity zone actually adopted the
// hero (fighterSide articles carry data-hero); retry — the deck can ignore
// a click that lands mid-animation (v1 desktop-EN fell back to ROBOT).
async function pickHero(hero, side) {
  for (let i = 0; i < 6; i++) {
    await clickSel(`button.rosterCard[data-hero="${hero}"]`);
    await sleep(700);
    const cur = await evl(`(()=>{ const e=document.getElementById('p${side}Side'); return e? e.getAttribute('data-hero') : null; })()`);
    if (cur === hero) return;
  }
  throw new Error(`hero select failed p${side}=${hero}`);
}
async function keyJ() {
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 74, code: 'KeyJ', key: 'j' });
  await sleep(70);
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 74, code: 'KeyJ', key: 'j' });
}

const MEASURE_EXPR = `(()=>{
  const hud=document.getElementById('hud'); if(!hud) return {error:'no hud'};
  const rows=[];
  const vis=el=>{ if(!el) return false; const cs=getComputedStyle(el); return cs.display!=='none'&&cs.visibility!=='hidden'&&el.getClientRects().length>0; };
  const probe=(root,side,sel,key)=>{
    const el=root?root.querySelector(sel):null;
    if(!el){ rows.push({side,key,sel,missing:true}); return; }
    const cs=getComputedStyle(el);
    rows.push({side,key,str:(el.textContent||'').trim(),font:parseFloat(cs.fontSize),ff:cs.fontFamily.split(',')[0].replace(/["']/g,''),cw:el.clientWidth,sw:el.scrollWidth,ov:Math.max(0,el.scrollWidth-el.clientWidth),ch:el.clientHeight,sh:el.scrollHeight,visible:vis(el)});
  };
  for(const [sideId,side] of [['p1Side','P1'],['p2Side','P2']]){
    const root=document.getElementById(sideId);
    probe(root,side,'.id-name','id-name');
    probe(root,side,'.id-sub','id-sub');
    probe(root,side,'.id-ctrl','id-ctrl');
    probe(root,side,'.rival-name','rival-name');
    probe(root,side,'.wp-name','wp-name');
    const wt=root?root.querySelector('.wp-txt'):null;
    rows.push({side,key:'wp-txt-wrap',visible:vis(wt),disp:wt?getComputedStyle(wt).display:'missing'});
    const wpb=root?root.querySelector('.weapon'):null;
    if(wpb) rows.push({side,key:'wp-block',tileCH:wpb.clientHeight,tileOv:wpb.scrollHeight-wpb.clientHeight,visible:vis(wpb)});
    const skills=root?[...root.querySelectorAll('.skill')]:[];
    skills.forEach((sk,i)=>{
      probe(sk,side,'.sk-name','sk-name-'+(i+1));
      probe(sk,side,'.sk-desc','sk-desc-'+(i+1));
      const st=sk.querySelector('.sk-state,.sk-meter');
      rows.push({side,key:'tile-'+(i+1),tileCH:sk.clientHeight,tileOv:sk.scrollHeight-sk.clientHeight,stateText:st?(st.textContent||'').trim().slice(0,24):'',skState:sk.getAttribute('data-state')||'',visible:vis(sk)});
    });
  }
  const r=hud.getBoundingClientRect();
  return { ds:{...hud.dataset}, hudRect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, rows };
})()`;

const GRANT_EXPR = `(()=>{
  const out={};
  const W = window.APEX_ARSENAL_WEAPONS || (window.APEX_ARSENAL&&window.APEX_ARSENAL.weapons) || {};
  const find=(re)=>{ for(const id of Object.keys(W)){ const def=W[id]||{}; const s=String(def.art||def.name||def.displayName||'')+' '+id; if(re.test(s)) return id; } return null; };
  out.jack=find(/jackhammer/i); out.moss=find(/mossberg/i);
  const f=window.fighters||[]; out.fighters=f.length;
  const api=window.APEX_ARSENAL&&window.APEX_ARSENAL.weaponApi;
  if(api&&f[0]&&out.jack) out.eq1=api.equip(f[0],out.jack);
  if(api&&f[1]&&out.moss) out.eq2=api.equip(f[1],out.moss);
  out.h1=api&&f[0]?((api.getHolder(f[0])||{}).weaponId||null):null;
  out.h2=api&&f[1]?((api.getHolder(f[1])||{}).weaponId||null):null;
  return out;
})()`;

const TILE1_STATE = `(()=>{ const sk=document.querySelector('#p1Side .skill'); if(!sk) return 'none'; const st=sk.querySelector('.sk-state,.sk-meter'); return (sk.getAttribute('data-state')||'')+'|'+(st?(st.textContent||'').trim():''); })()`;

async function measurePhase(ctx, phase) {
  const m = await evl(MEASURE_EXPR);
  const bad = (m.rows || []).filter((r) => r.visible && r.ov > 1);
  console.log(`  MEASURE ${phase} ds=${JSON.stringify(m.ds || {})} overflow=${bad.length}`);
  for (const r of bad) console.log(`    OVF ${r.side} ${r.key} ${JSON.stringify(r.str)} f=${r.font} ff=${r.ff} cw=${r.cw} sw=${r.sw} ov=+${r.ov}`);
  ctx.phases[phase] = m;
  return m;
}

async function runContext(c) {
  console.log('CONTEXT', c.id, `${c.w}x${c.h}`, c.mode, c.lang, c.p1, 'vs', c.p2);
  const res = { ...c, phases: {} };
  await cmd('Emulation.setDeviceMetricsOverride', { width: c.w, height: c.h, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: APP });
  await sleep(2500);
  await evl(`localStorage.setItem('apex-chaos.ui-language.v1', ${JSON.stringify(c.lang)})`);
  await cmd('Page.navigate', { url: APP });
  await sleep(4500);
  const hasStart = await evl(`!!document.getElementById('apex-boot-start')`);
  if (hasStart) await clickSel('#apex-boot-start');
  await waitFor(`!!document.getElementById('freeBattle')`, 20000, 'home freeBattle');
  await sleep(1200);
  await clickSel('#freeBattle');
  await waitFor(`document.querySelectorAll('.modeCard').length>=2`, 15000, 'mode cards');
  await sleep(800);
  const modeIdx = c.mode === 'local' ? 1 : 0;
  await evl(`(()=>{ const e=document.querySelectorAll('.modeCard')[${modeIdx}]; e.scrollIntoView({block:'center'}); e.click(); return true; })()`);
  await waitFor(`!!document.querySelector('button.rosterCard[data-hero]')`, 15000, 'roster');
  await sleep(1200);
  await pickHero(c.p1, 1);
  await clickSel('#lockIn');
  await waitFor(`(document.getElementById('stage')?.className||'').includes('fighter-active-p2')`, 15000, 'p2 pick phase');
  await sleep(600);
  await pickHero(c.p2, 2);
  await clickSel('#lockIn');
  await waitFor(`!!document.getElementById('hud') && !!document.getElementById('hud').dataset.mode`, 35000, 'battle hud');
  await sleep(2800);
  await measurePhase(res, 'raw');
  await shot(`${c.id}-raw`);
  // Weapons: equip and capture immediately (live battle churns holders).
  res.grant = await evl(GRANT_EXPR);
  console.log('  GRANT', JSON.stringify(res.grant));
  await sleep(320);
  await measurePhase(res, 'weapons');
  await shot(`${c.id}-weapons`);
  // Cast choreography in this build (diagnosed on MAGNET/CRYSTALA/ROBOT):
  // press -> cast|PRESS-CAST -> active|ACTIVE Xs countdown -> ready.
  // No long numeric cooldown-countdown state ever renders on the tile, so the
  // representative "cooldown running" frame is the mid-ACTIVE countdown.
  // Sequence: press A1, catch PRESS-CAST; then re-equip long weapons, press
  // A2 (longest windows), and capture measure+shot at the first ACTIVE sample
  // so long skill name + countdown + long weapon name share one frame.
  await evl(`(()=>{ try{ window.APEX_GOLD.pressSkill(0,0,{src:'acceptance'}); }catch(e){} return true; })()`);
  let castState = '';
  for (let i = 0; i < 8; i++) { await sleep(300); castState = await evl(TILE1_STATE); if (!/ready/i.test(castState)) break; }
  if (/ready/i.test(castState)) {
    await keyJ();
    for (let i = 0; i < 8; i++) { await sleep(300); castState = await evl(TILE1_STATE); if (!/ready/i.test(castState)) break; }
  }
  res.castState = castState;
  console.log('  CAST STATE', JSON.stringify(castState));
  await shot(`${c.id}-cast`);
  res.regrant = await evl(GRANT_EXPR);
  await sleep(250);
  const TILES = `(()=>{ const out=[]; for(const side of ['p1Side','p2Side']){ const sks=[...document.querySelectorAll('#'+side+' .skill')]; sks.forEach((e,i)=>{ const st=e.querySelector('.sk-state,.sk-meter'); out.push(side+'#'+(i+1)+' '+(e.getAttribute('data-state')||'')+'|'+(st?st.textContent.trim():'')); }); } return out.join(' ;; '); })()`;
  await evl(`(()=>{ try{ window.APEX_GOLD.pressSkill(0,1,{src:'acceptance'}); window.APEX_GOLD.pressSkill(0,0,{src:'acceptance'}); }catch(e){} return true; })()`);
  let activeState = '';
  for (let i = 0; i < 22; i++) { await sleep(120); activeState = await evl(TILES); if (/active\|/i.test(activeState)) break; }
  res.activeState = activeState;
  console.log('  ACTIVE STATE', JSON.stringify(activeState));
  await measurePhase(res, 'cooldown');
  await shot(`${c.id}-cooldown`);
  return res;
}

async function main() {
  for (let i = 0; i < 80; i++) { try { await httpJson('/json/version'); break; } catch { await sleep(300); if (i === 79) throw new Error('devtools up fail'); } }
  const targets = await httpJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const results = [];
  for (const c of CONTEXTS) {
    if (only && !only.includes(c.id)) continue;
    try { results.push(await runContext(c)); }
    catch (e) { console.log('CONTEXT ERROR', c.id, String(e.message || e)); results.push({ ...c, error: String(e.message || e) }); try { await shot(c.id + '-ERROR'); } catch {} }
  }
  fs.writeFileSync(`${OUTDIR}/suite-results.json`, JSON.stringify(results, null, 2));
  console.log('WROTE suite-results.json contexts=', results.length);
  try { ws.close(); } catch {}
  chrome.kill('SIGKILL');
}
main().catch((e) => { console.error('FATAL', e); try { chrome.kill('SIGKILL'); } catch {} process.exit(1); });
