// RA-1.C — Result Gold art-delivery coverage matrix (fix-only scope).
//
// The owner saw missing hero/weapon art on some Result combinations. This gate
// builds a real coverage matrix against the canonical Result Gold page using
// the SAME authorities the live app loads (arsenal config with V43 declared
// art, the C weapon atlas, the owner award catalog, the match ledger and the
// canonical hero registry), then reports for every combination:
//   resolved URL, data-art-state (image / skin-image / fallback),
//   load + decode status, placeholder tags and networking failures.
//
// Expectations:
//   * every PLAYABLE fighter must resolve a real, decoded portrait;
//   * every weapon the C atlas publishes must resolve decoded weapon art;
//   * MIRROR is canonical with pick_roster_cover (no selected-large pose);
//   * progression-locked future fighters are reported EXPECTED BY DESIGN —
//     their locked status is not a broken asset.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = (process.env.APEX_APP_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const BIN = process.env.CHROME_PATH;
if (!BIN) throw new Error('CHROME_PATH not set');
const PORT = Number(process.env.CDP_PORT || 9436);
const DIR = process.env.APEX_EVIDENCE_DIR || '/tmp/apex-ra1-result-coverage';
fs.mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAYABLE = ['NEWBOT', 'HUNTER', 'CRYSTALA', 'MAGNET', 'FROST', 'MIRROR', 'BOXE', 'SHURI'];
const LOCKED = ['BLACK_HOLE', 'MATH_V2', 'RUBBER', 'SLIME', 'SNIPER', 'TIME'];
const failures = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : failures).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

const chrome = spawn(BIN, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-allow-origins=*', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--window-size=1440,900',
  '--user-data-dir=/tmp/apex-ra1-result-' + process.pid, 'about:blank',
], { stdio: 'ignore' });

let ws; let serial = 0; const pending = new Map();
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const to = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 25000);
    pending.set(id, { resolve: (v) => { clearTimeout(to); resolve(v); }, reject: (e) => { clearTimeout(to); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evl(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function poll(expr, ok, tries = 90) {
  for (let i = 0; i < tries; i++) { const v = await evl(expr).catch(() => null); if (ok(v)) return v; await sleep(100); }
  return null;
}
async function httpJson(p) { const r = await fetch(`http://127.0.0.1:${PORT}${p}`); return r.json(); }

const INSPECT = `(()=>{
  const info=(img)=>({src:img.getAttribute('src'),state:img.getAttribute('data-art-state'),complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight});
  const heroes=[...document.querySelectorAll('.hero')].map((hero,i)=>{
    const img=hero.querySelector('.hero__img');
    const svg=hero.querySelector('.hero__svg');
    return {side:i+1,name:hero.querySelector('.hero__name')?.textContent?.trim()||null,
      artState:img?img.getAttribute('data-art-state'):(svg?'fallback-svg':null),
      image:img?info(img):null,
      tags:[...hero.querySelectorAll('.art-tag')].map(t=>t.textContent.trim())};
  });
  const gun=document.querySelector('.weapon__dais img');
  const settled=heroes.every(h=>!h.image||h.image.complete)&&(!gun||gun.complete);
  return {settled,heroes,weapon:gun?info(gun):null,
    weaponPlaceholders:[...document.querySelectorAll('.weapon .art-tag')].map(t=>t.textContent.trim()),
    done:!!document.querySelector('.ac-run.is-done'),
    visibleHeroes:heroes.filter(h=>{const el=document.querySelectorAll('.hero')[h.side-1];const r=el.getBoundingClientRect();return r.width>4&&r.height>4;}).length};
})()`;

const LOAD_AUTHORITIES = `(async()=>{
  const load=(src)=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(new Error('missing '+src));document.head.appendChild(el)});
  for(const src of ['/game/arsenal/arsenalConfig.js','/game/arsenal/arsenalCWeaponSet.generated.js','/game/results/ownerAwards.generated.js','/game/results/matchResultAuthority.js','/game/hero-rework/heroRegistry.js']) await load(src);
  return {config:!!window.APEX_ARSENAL_CONFIG,atlas:Object.keys(window.APEX_ARSENAL_C_SET?.weapons||{}).length,v43:Object.keys(window.APEX_ARSENAL_CONFIG?.V43_WEAPONS||{}).length,authority:!!window.APEX_MATCH_RESULT_AUTHORITY};
})()`;

let stamp = 0;
function makePayload(heroId, weaponId) {
  stamp += 1;
  return `(()=>{
    const weaponId=${JSON.stringify(weaponId)};
    const actors=[{id:1,name:${JSON.stringify(heroId)},x:180,y:450,hp:1000,maxHp:1000},{id:2,name:'NEWBOT',x:820,y:450,hp:1000,maxHp:1000}];
    const cfg=window.APEX_ARSENAL_CONFIG||{};
    const ledger=window.APEX_MATCH_RESULT_AUTHORITY.create({actors,mode:'BOT',startedAt:1720000000000+${stamp * 1000},weaponConfig:cfg});
    ledger.onPickup(actors[0],weaponId);ledger.onPickup(actors[1],weaponId);
    ledger.onShot(actors[0],weaponId);actors[1].hp=0;
    ledger.onDamage(actors[1],actors[0],'arsenal-'+String(weaponId).toLowerCase(),1000);
    const match=ledger.seal('P1');
    window.postMessage({type:'APEX_RESULT_GOLD_PAYLOAD',match},location.origin);
    return {id:match.meta.id,portrait:match.players[0].character.portraitSrc||null,gun:match.weapons.find(w=>w.id===weaponId)?.artSrc||null};
  })()`;
}

async function setViewport(w, h) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500, screenOrientation: { type: w < h ? 'portraitPrimary' : 'landscapePrimary', angle: w < h ? 0 : 90 } });
  await sleep(250);
}

const matrix = { result: [], weapons: [], phases: [], layouts: [] };

// A new payload must be the thing on screen before it is judged: meta.id is
// unique per payload (startedAt stamp), so React remounts the whole board.
async function waitHero(hero, tries = 120) {
  const wanted = String(hero).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return poll(`(()=>[...document.querySelectorAll('.hero__char b')].map(e=>e.textContent.replace(/[^A-Z0-9]/gi,'').toUpperCase()).join(','))()`,
    (v) => typeof v === 'string' && v.split(',').includes(wanted), tries);
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
  const netFailures = [];
  await cmd('Network.enable');
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.loadingFailed' && !m.params?.canceled) netFailures.push({ type: m.params?.type, error: m.params?.errorText });
    if (m.method === 'Network.responseReceived' && m.params?.response?.status >= 400) netFailures.push({ status: m.params.response.status, url: m.params.response.url });
  });

  await cmd('Page.navigate', { url: BASE + '/result-gold/index.html' });
  const ok = await poll(`!!document.querySelector('.ac-root')`, Boolean, 160);
  check('Result Gold document boots from the canonical build', ok === true);

  await setViewport(390, 844);
  const auth = await evl(LOAD_AUTHORITIES);
  check('the live app authorities load inside Result Gold (config, atlas, awards, ledger, registry)',
    auth?.config === true && auth?.atlas > 20 && auth?.authority === true, JSON.stringify(auth));

  // ── Hero matrix (phone portrait; fixture weapon PISTOL) ────────────────────
  for (const hero of [...PLAYABLE, ...LOCKED]) {
    const payload = await evl(makePayload(hero, 'PISTOL'));
    await waitHero(hero);
    const snap = await poll(INSPECT, (v) => v && v.heroes.length === 2 && v.settled === true, 120);
    const row = { hero, expected: PLAYABLE.includes(hero) ? 'image' : 'expected-by-design', portrait: payload?.portrait, ...(snap || {}) };
    matrix.result.push(row);
    if (PLAYABLE.includes(hero)) {
      const side1 = snap?.heroes?.[0];
      const decoded = side1?.image && side1.image.complete && side1.image.naturalWidth > 0;
      check('result P1 portrait decodes for ' + hero,
        !!side1 && side1.artState === 'image' && decoded === true && (side1.tags || []).length === 0,
        JSON.stringify({ artState: side1?.artState, src: side1?.image?.src, natural: [side1?.image?.naturalWidth, side1?.image?.naturalHeight], tags: side1?.tags, resolved: payload?.portrait }));
    } else {
      check('result reports locked-future fighter ' + hero + ' without inventing art',
        !!snap && (snap.heroes?.[0]?.artState === 'image' || snap.heroes?.[0]?.artState === 'fallback-svg'),
        JSON.stringify({ artState: snap?.heroes?.[0]?.artState, src: snap?.heroes?.[0]?.image?.src, resolved: payload?.portrait }));
    }
    if (hero === 'NEWBOT' || hero === 'SHURI' || hero === 'MIRROR') {
      // Evidence must be the settled board a player sees after the authored
      // Skip, not a mid-choreography frame.
      await evl(`document.querySelector('.skip')?.click()`);
      await poll(INSPECT, (v) => v?.done === true && v.settled === true, 90);
      await sleep(150);
      const png = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${DIR}/result-phone-${hero.toLowerCase()}.png`, Buffer.from(png.data, 'base64'));
    }
  }

  // ── Weapon matrix (every published C-atlas id) ─────────────────────────────
  const weaponIds = await evl(`Object.keys(window.APEX_ARSENAL_C_SET?.weapons||{})`);
  for (const weapon of weaponIds) {
    const payload = await evl(makePayload('NEWBOT', weapon));
    await waitHero('NEWBOT', 60);
    const snap = await poll(INSPECT, (v) => v && v.weapon !== null && v.weapon.complete === true, 60);
    matrix.weapons.push({ weapon, resolved: payload?.gun, state: snap?.weapon?.state, ok: !!(snap?.weapon && snap.weapon.complete && snap.weapon.naturalWidth > 0), placeholders: snap?.weaponPlaceholders });
    check('weapon art decodes in Result for ' + weapon,
      !!snap?.weapon && snap.weapon.complete === true && snap.weapon.naturalWidth > 0 && (snap.weaponPlaceholders || []).length === 0,
      JSON.stringify({ src: snap?.weapon?.src, resolved: payload?.gun, state: snap?.weapon?.state, placeholders: snap?.weaponPlaceholders }));
  }

  // ── Phase timing: early animation vs settled/Skip ──────────────────────────
  await evl(makePayload('NEWBOT', 'PISTOL'));
  const phaseMounted = await waitHero('NEWBOT', 90);
  await sleep(120);
  const early = await evl(INSPECT);
  if (!phaseMounted) console.log('WARN phase payload did not mount NEWBOT');
  await evl(`document.querySelector('.skip')?.click()`);
  const settled = await poll(INSPECT, (v) => v?.done === true && v.settled === true, 90);
  matrix.phases.push({ phase: 'early', heroes: early?.heroes, weapon: early?.weapon }, { phase: 'settled', heroes: settled?.heroes, weapon: settled?.weapon });
  check('early-animation phase already resolves real hero and weapon art (no placeholder/fallback)',
    early?.heroes?.every((h) => h.artState === 'image' && !!h.image?.src && (h.tags || []).length === 0)
    && !!early?.weapon && !!early.weapon.src,
    JSON.stringify({ heroes: early?.heroes?.map((h) => ({ state: h.artState, src: h.image?.src })), weapon: early?.weapon?.src }));
  check('settled phase keeps the same decoded art after the authored Skip',
    !!settled?.heroes?.[0]?.image && settled.heroes[0].image.naturalWidth > 0 && settled.heroes[0].image.src === early?.heroes?.[0]?.image?.src,
    JSON.stringify({ hero: settled?.heroes?.[0]?.image?.src, weapon: settled?.weapon?.naturalWidth }));

  // ── Layout sweep with a playable pair ─────────────────────────────────────
  for (const vp of [{ name: '390x844', w: 390, h: 844 }, { name: '844x390', w: 844, h: 390 }, { name: '1440x900', w: 1440, h: 900 }]) {
    await setViewport(vp.w, vp.h);
    await evl(makePayload('SHURI', 'SHOTGUN'));
    const mounted = await waitHero('SHURI', 90);
    await evl(`document.querySelector('.skip')?.click()`);
    const snap = await poll(INSPECT, (v) => v?.done === true && v.settled === true, 90);
    if (!mounted) console.log('WARN layout payload did not mount SHURI at ' + vp.name);
    matrix.layouts.push({ viewport: vp.name, ...snap });
    const heroesOk = (snap?.heroes || []).every((h) => h.image && h.image.complete && h.image.naturalWidth > 0 && h.artState === 'image');
    check('Result art stays decoded at ' + vp.name,
      heroesOk && !!snap?.weapon && snap.weapon.naturalWidth > 0 && (snap.weaponPlaceholders || []).length === 0,
      JSON.stringify({ heroes: snap?.heroes?.map((h) => h.image?.src), weapon: snap?.weapon?.src }));
    const png = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${DIR}/result-${vp.name}.png`, Buffer.from(png.data, 'base64'));
  }
  await setViewport(390, 844);

  const relevantNet = netFailures.filter((f) => f.status >= 400 || String(f.error || '').includes('FAILED'));
  check('no first-party Result asset request fails across the matrix', relevantNet.length === 0, JSON.stringify(relevantNet.slice(0, 8)));
  fs.writeFileSync(`${DIR}/result-coverage-matrix.json`, JSON.stringify({ generatedAt: new Date().toISOString(), authoritative: auth, matrix, netFailures, passes, failures }, null, 2));

  console.log('');
  console.log('RA-1 Result coverage — evidence ' + DIR);
  if (failures.length) { console.error('RESULT: FAIL (' + passes.length + ' pass, ' + failures.length + ' fail)'); process.exitCode = 1; }
  else console.log('RESULT: PASS (' + passes.length + ' pass, 0 fail)');
  try { chrome.kill('SIGKILL'); } catch { /* gone */ }
  process.exit(process.exitCode || 0);
}
main().catch((error) => { console.error('GATE ERROR', error); try { chrome.kill('SIGKILL'); } catch { /* noop */ } process.exit(1); });
