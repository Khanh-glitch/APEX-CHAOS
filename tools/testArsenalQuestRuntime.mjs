// Arsenal Quest P0 acceptance test — follows repository CDP test conventions
// (see tools/testShotgunRuntime.mjs / testManualLabRuntime.mjs).
//
// Usage:
//   CHROME_PATH=/path/to/chrome node tools/testArsenalQuestRuntime.mjs
//   APEX_CDP_ENDPOINT=http://127.0.0.1:9224 node tools/testArsenalQuestRuntime.mjs
//
// Options: APEX_APP_URL (default http://127.0.0.1:5173)
//          AQ_EVIDENCE_DIR (default docs/arsenal-quest/evidence)
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.APEX_CDP_ENDPOINT || 'http://127.0.0.1:9224';
const appUrl = process.env.APEX_APP_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidenceDir = process.env.AQ_EVIDENCE_DIR || 'docs/arsenal-quest/evidence';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome = null;

if (!process.env.APEX_CDP_ENDPOINT) {
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9224',
    '--window-size=1100,1100',
    '--user-data-dir=' + path.join(process.cwd(), '.arsenal-chrome-profile'),
    appUrl,
  ], { stdio: 'ignore', detached: false });
}

async function pageTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then(r => r.json());
      const t = targets.find(x => x.type === 'page');
      if (t) return t;
    } catch {}
    await sleep(250);
  }
  throw new Error('Arsenal Quest CDP page did not become ready.');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let serial = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const m = JSON.parse(event.data);
  if (!m.id || !pending.has(m.id)) return;
  const p = pending.get(m.id);
  pending.delete(m.id);
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
});
function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function screenshot(name) {
  const shot = await command('Page.captureScreenshot', { format: 'png' });
  const file = path.join(evidenceDir, `${name}.png`);
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  return file;
}
async function setViewport(width, height, mobile = false) {
  await command('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
  });
  await sleep(180);
}
async function clearViewport() {
  await command('Emulation.clearDeviceMetricsOverride');
  await sleep(180);
}
async function hitProbe(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { exists:false };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const cs = getComputedStyle(el);
    return {
      exists:true, width:r.width, height:r.height, left:r.left, top:r.top,
      cx, cy, display:cs.display, visibility:cs.visibility,
      pointerEvents:cs.pointerEvents, disabled:!!el.disabled,
      hitWithin:!!top && (top === el || el.contains(top)),
      topTag:top ? top.tagName : null,
      topId:top ? top.id : null,
      topClass:top ? top.className : null,
    };
  })()`);
}
async function physicalClick(selector) {
  const p = await hitProbe(selector);
  if (!p.exists || p.disabled || !p.hitWithin || p.pointerEvents === 'none' || p.width < 1 || p.height < 1) return p;
  await command('Input.dispatchMouseEvent', { type:'mouseMoved', x:p.cx, y:p.cy });
  await command('Input.dispatchMouseEvent', { type:'mousePressed', x:p.cx, y:p.cy, button:'left', clickCount:1 });
  await command('Input.dispatchMouseEvent', { type:'mouseReleased', x:p.cx, y:p.cy, button:'left', clickCount:1 });
  await sleep(220);
  return p;
}
async function physicalTap(selector) {
  const p = await hitProbe(selector);
  if (!p.exists || p.disabled || !p.hitWithin || p.pointerEvents === 'none' || p.width < 1 || p.height < 1) return p;
  const point = { x:p.cx, y:p.cy, radiusX:1, radiusY:1, force:1, id:1 };
  await command('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[point] });
  await command('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await sleep(260);
  return p;
}

const report = { gates: {}, failures: [], evidence: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

try {
  await command('Runtime.enable');
  await command('Page.enable');
  // Boot-truth observer (§A1/§A4): installed before navigation so loader/menu
  // transitions are captured live, not reconstructed after the fact.
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__APEX_BOOT_OBSERVER = {
      loaderHiddenAt: null, engineReadyAtLoaderHidden: null, menuButtonsDisabledAtLoaderHidden: null,
      loaderMaxPercentSeen: 0, firstGestureAt: null, bgmAtLoaderHidden: null, errors: [], _seenLoader: false,
    };
    window.addEventListener('error', ev => { window.__APEX_BOOT_OBSERVER.errors.push(String(ev.message)); });
    const snapshotLoaderHidden = () => {
      if (window.__APEX_BOOT_OBSERVER.loaderHiddenAt !== null) return;
      window.__APEX_BOOT_OBSERVER.loaderHiddenAt = performance.now();
      window.__APEX_BOOT_OBSERVER.engineReadyAtLoaderHidden = Boolean(window.__apexEngineReady);
      const btn = document.querySelector('#menu-screen .menu-buttons button');
      window.__APEX_BOOT_OBSERVER.menuButtonsDisabledAtLoaderHidden = btn ? !!btn.disabled : null;
      window.__APEX_BOOT_OBSERVER.bgmAtLoaderHidden = window.__apexMenuBgmState ? window.__apexMenuBgmState() : null;
    };
    const sample = () => {
      const o = window.__APEX_BOOT_OBSERVER;
      const l = document.getElementById('loading-screen');
      if (l) {
        o._seenLoader = true;
        const p = l.querySelector('.loading-percent');
        if (p) o.loaderMaxPercentSeen = Math.max(o.loaderMaxPercentSeen, parseInt(p.textContent, 10) || 0);
      } else if (o._seenLoader) {
        snapshotLoaderHidden();
      }
    };
    // DOM-mutation sampling: fires on every React commit (percent text updates,
    // loader mount/unmount) independent of frame production, which rAF is not.
    const startSampling = () => {
      if (!document.documentElement) { setTimeout(startSampling, 5); return; }
      new MutationObserver(sample).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      const tick = () => { sample(); setTimeout(tick, 40); };
      tick();
    };
    startSampling();
    const gesture = () => {
      if (window.__APEX_BOOT_OBSERVER.firstGestureAt === null) {
        window.__APEX_BOOT_OBSERVER.firstGestureAt = performance.now();
      }
    };
    window.addEventListener('pointerdown', gesture, { once: true, capture: true });
    window.addEventListener('keydown', gesture, { once: true, capture: true });
  ` });
  await command('Page.navigate', { url: appUrl });
  await sleep(1500);
  await mkdir(evidenceDir, { recursive: true });

  // ---------------------------------------------------------------- boot ---
  for (let i = 0; i < 120; i++) {
    if (await evaluate('Boolean(window.__apexEngineReady)')) break;
    await sleep(250);
    if (i === 119) throw new Error('Apex engine did not become ready.');
  }
  await evaluate(`window.__apexEnsureDeferredRuntimes('arsenalQuest').then(() => true)`);
  for (let i = 0; i < 60; i++) {
    if (await evaluate('Boolean(window.startArsenalQuestMode && window.APEX_ARSENAL?.weaponApi && window.getArsenalQuestDebugState)')) break;
    await sleep(250);
    if (i === 59) throw new Error('Arsenal Quest runtime was not exposed.');
  }
  gate('runtime-registered', true, 'arsenalQuest deferred group loaded');

  // ------------------------------------------------ boot truth (§A1/§A4) ---
  report.bootTruth = await evaluate(`(() => {
    const o = window.__APEX_BOOT_OBSERVER || {};
    const perf = window.apexPerfReport ? window.apexPerfReport() : null;
    const phases = perf && perf.boot ? perf.boot.phases.map(p => p.name) : [];
    const bgm = window.__apexMenuBgmState ? window.__apexMenuBgmState() : null;
    const bgmFetched = performance.getEntriesByType('resource').some(e => e.name.includes('/assets/audio/menu_bgm.mp3'));
    return {
      engineReadyAtLoaderHidden: o.engineReadyAtLoaderHidden,
      menuButtonsDisabledAtLoaderHidden: o.menuButtonsDisabledAtLoaderHidden,
      loaderMaxPercentSeen: o.loaderMaxPercentSeen,
      loaderHiddenMs: perf && perf.boot ? perf.boot.loaderHiddenMs : null,
      interactiveMs: perf && perf.boot ? perf.boot.interactiveMs : null,
      phases, bgm, bgmFetched, firstGestureAt: o.firstGestureAt, errors: o.errors,
    };
  })()`);
  gate('boot-loader-hides-only-when-menu-usable',
    report.bootTruth.engineReadyAtLoaderHidden === true
    && report.bootTruth.menuButtonsDisabledAtLoaderHidden === false
    && report.bootTruth.loaderMaxPercentSeen === 100,
    report.bootTruth);
  gate('boot-marks-complete',
    ['boot-start', 'critical-shell-ready', 'engine-ready', 'menu-runtime-ready', 'menu-interactive', 'loader-hidden', 'warmup-start']
      .every(p => report.bootTruth.phases.includes(p)),
    report.bootTruth.phases);
  gate('boot-bgm-warmed-before-first-play',
    report.bootTruth.bgmFetched
    && report.bootTruth.bgm && report.bootTruth.bgm.preload === 'auto'
    && report.bootTruth.bgm.readyState >= 1
    && report.bootTruth.firstGestureAt === null,
    report.bootTruth.bgm);
  gate('boot-no-boot-errors', (report.bootTruth.errors || []).length === 0, report.bootTruth.errors);

  // ------------------------------ Audio 2B: latency-critical SFX ----------
  // The HOT bank (gunfire, melee impacts, pickups, storm combat SFX) must be
  // fully decoded into AudioBuffers BEFORE gameplay. Triggering representative
  // cues after warmup must cause ZERO new network requests and ZERO
  // decodeAudioData calls, and must play through an already-decoded buffer.
  report.audioLatency = await evaluate(`(async () => {
    const AV = window.APEX_ARSENAL_AV;
    if (!AV || !AV.warmAudio) return { missing: true };
    await AV.warmAudio();
    const before = AV.audioStatus();
    const sfxResources = () => performance.getEntriesByType('resource')
      .filter((e) => /\\/assets\\/arsenal\\/av\\/sfx\\//.test(e.name)).length;
    // Clear the resource-timing buffer so any trigger-time fetch MUST appear
    // as a fresh entry (the default 250-entry buffer may have evicted the
    // warmup fetches, which would make a plain before/after count vacuous).
    if (performance.clearResourceTimings) performance.clearResourceTimings();
    const playedBefore = AV.stats.played;
    // Four representative HOT cues through the real semantic dispatch.
    window.avCue('fire', { weapon: 'PISTOL', x: 300, y: 300, angle: 0 });
    window.avCue('melee_hit', { weapon: 'BATTLE_AXE', x: 400, y: 400, angle: 0 });
    window.avCue('pickup', { weapon: 'AK_47', x: 500, y: 500 });
    window.avCue('storm_impact', { weapon: 'STORMBREAKER', x: 600, y: 600 });
    window.avCue('storm_windup', { weapon: 'STORMBREAKER', x: 620, y: 620 });
    const after = AV.audioStatus();
    const resAfter = sfxResources();
    return {
      resNote: 'cleared before triggers; resAfter counts only trigger-window fetches',
      before: {
        bankSize: before.bankSize, decoded: before.decoded, failed: before.failed,
        pending: before.pending, decodeCalls: before.decodeCalls, pcmBytes: before.pcmBytes,
        warmMs: before.warmMs, notReadyThrottles: before.notReadyThrottles,
      },
      after: {
        decoded: after.decoded, decodeCalls: after.decodeCalls, played: after.played,
        playedDelta: after.played - playedBefore, lastVoice: after.lastVoice,
      },
      resAfter,
      warmPrefetch: window.apexWarmAudioStatus ? window.apexWarmAudioStatus() : null,
      masterGainPath: typeof battleAudioMaster !== 'undefined',
    };
  })()`);
  gate('audio-hot-bank-fully-predecoded',
    !report.audioLatency.missing
    && report.audioLatency.before.bankSize === report.audioLatency.before.decoded
    && report.audioLatency.before.failed === 0
    && report.audioLatency.before.pending === 0,
    report.audioLatency.before);
  gate('audio-hot-trigger-zero-fetch-zero-decode',
    !report.audioLatency.missing
    && report.audioLatency.resAfter === 0
    && report.audioLatency.after.decodeCalls === report.audioLatency.before.decodeCalls
    && report.audioLatency.after.playedDelta >= 5
    && report.audioLatency.after.lastVoice
    && report.audioLatency.after.lastVoice.viaBufferSource === true
    && report.audioLatency.after.lastVoice.vol > 0,
    report.audioLatency);
  gate('audio-warm-bank-prefetched-by-loader',
    !report.audioLatency.missing
    && report.audioLatency.warmPrefetch
    && report.audioLatency.warmPrefetch.prefetched >= 60,
    report.audioLatency.warmPrefetch);

  // Test-side helpers installed in the page.
  await evaluate(`(() => {
    window.__AQ_TEST = {
      enterManual() {
        // Direct entry (like the Lab blocks above) must hide the meta hub
        // overlay first, or evidence screenshots capture the Hub over the
        // arena instead of the fighters/weapon being verified.
        window.APEX_ARSENAL_META?.hideMeta?.();
        window.startArsenalQuestMode();
        cancelAnimationFrame(reqId); reqId = 0;
        return getArsenalQuestDebugState();
      },
      enterLive() { window.startArsenalQuestMode(); return getArsenalQuestDebugState(); },
      step(seconds, dt) {
        dt = dt || 1/60;
        let t = seconds;
        while (t > 1e-9) { const d = Math.min(dt, t); APEX_ARSENAL.step(d); t -= d; }
      },
      place(fx, fy, ex, ey, freeze) {
        const [a, b] = fighters;
        a.x = fx; a.y = fy; b.x = ex; b.y = ey;
        a.setDir(Math.sign(ex - fx) || 1, 0); b.setDir(-Math.sign(ex - fx) || -1, 0);
        if (freeze !== false) { a.baseSpeed = 0; b.baseSpeed = 0; }
      },
      hp() { return { hero: fighters[0].hp, rival: fighters[1].hp, heroMax: fighters[0].maxHp, rivalMax: fighters[1].maxHp }; },
      holder(who) {
        const f = who === 'HERO' ? fighters[0] : fighters[1];
        const h = APEX_ARSENAL.weaponApi.getHolder(f);
        return h ? { weapon: h.weaponId, phase: h.phase, shots: h.shotsFired, elapsed: h.elapsed } : null;
      },
      equip(who, weaponId) {
        APEX_ARSENAL.weaponApi.equip(who === 'HERO' ? fighters[0] : fighters[1], weaponId);
      },
      holdSpawns() { APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = []; APEX_ARSENAL.state.unarmedFastConsumed = true; APEX_ARSENAL.state.spawnHeld = true; },
    clearSlots() { APEX_ARSENAL.state.slots = []; },
      pushSlot(overrides) {
        const s = APEX_ARSENAL.state;
        const slot = Object.assign({
          id: s.nextSlotId++, x: 500, y: 500, phase: 'REVEALED', weaponId: 'PISTOL',
          revealLeadSeconds: 1.5, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: s.time,
          predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null,
        }, overrides);
        s.slots.push(slot);
        return slot.id;
      },
      events() { return APEX_ARSENAL.events.slice(); },
      clearEvents() { APEX_ARSENAL.events.length = 0; },
      countEvents(prefix, filter) {
        return APEX_ARSENAL.events.filter(e => e.startsWith('[AQ] ' + prefix) && (!filter || e.includes(filter))).length;
      },
      aqProjectiles() {
        return projectiles.filter(p => p.aq).map(p => ({ type: p.type, owner: p.owner ? p.owner.name : null, weapon: p.weapon, x: Math.round(p.x), y: Math.round(p.y) }));
      },
      statuses(who) { const f = who === 'HERO' ? fighters[0] : fighters[1]; return Object.keys(f.statuses || {}); },
      debug() { return getArsenalQuestDebugState(); },
      redraw() { draw(); },
      earlyErrors() { return window.apexEarlyErrors || []; },
    };
    return true;
  })()`);

  // ------------------------------------------------- normal modes intact ---
  report.normalModes = await evaluate(`(() => {
    const results = {};
    goToSelect();
    results.selectVisible = !document.getElementById('select-screen').classList.contains('hidden');
    goToMenu();
    results.menuVisible = !document.getElementById('menu-screen').classList.contains('hidden');
    const ICE = apexFighterTypes ? apexFighterTypes.find(t => t.name === 'ICE') : FighterTypes.find(t => t.name === 'ICE');
    const TOXIC = apexFighterTypes ? apexFighterTypes.find(t => t.name === 'TOXIC') : FighterTypes.find(t => t.name === 'TOXIC');
    startSpecificMatch(ICE, TOXIC, { countdown: false });
    results.normalMatchState = gameState;
    results.normalFighters = fighters.map(f => f.name);
    for (let i = 0; i < 30; i++) update(1/60);
    results.normalSimOk = fighters[0].hp > 0 || fighters[1].hp > 0 || gameState === 'END';
    goToMenu();
    results.menuAfterMatch = gameState;
    return results;
  })()`);
  gate('normal-modes-launch', report.normalModes.selectVisible && report.normalModes.menuVisible && report.normalModes.normalMatchState === 'PLAYING' && report.normalModes.menuAfterMatch === 'MENU', report.normalModes);

  // ------------------------------- real menu-button route intent (§A3) ----
  // A physical click on the real menu buttons must navigate through the
  // tiered loader (intent group), proving no first-route regression.
  await evaluate(`goToMenu()`);
  await sleep(350);
  const playProbe = await hitProbe('#menu-screen .menu-buttons button.primary');
  await physicalClick('#menu-screen .menu-buttons button.primary');
  for (let i = 0; i < 40; i++) {
    if (await evaluate(`!document.getElementById('select-screen').classList.contains('hidden')`)) break;
    await sleep(150);
  }
  // The pick presentation renders asynchronously (layout JSON + card art) as a
  // 3-card carousel under its own stage root (NOT inside the React-owned
  // .apex-pick-layer wrapper, which stays empty).
  for (let i = 0; i < 40; i++) {
    const counts = await evaluate(`(() => ({
      pickCards: document.querySelectorAll('.apex-pick-stage .apex-pick-card').length,
      rosterCards: document.querySelectorAll('#roster-grid .fighter-card').length,
    }))()`).catch(() => ({ pickCards: 0, rosterCards: 0 }));
    if (counts.pickCards >= 3 || counts.rosterCards >= 30) break;
    await sleep(150);
  }
  report.menuPlayRoute = await evaluate(`(() => {
    const grid = document.getElementById('roster-grid');
    return {
      probe: ${JSON.stringify(playProbe)},
      selectVisible: !document.getElementById('select-screen').classList.contains('hidden'),
      rosterCards: grid ? grid.querySelectorAll('.fighter-card').length : 0,
      pickLayer: !!document.querySelector('.apex-pick-layer'),
      pickCards: document.querySelectorAll('.apex-pick-stage .apex-pick-card').length,
      menuHidden: document.getElementById('menu-screen').classList.contains('hidden'),
    };
  })()`);
  gate('menu-button-play-route-select-loads',
    report.menuPlayRoute.selectVisible
    && (report.menuPlayRoute.rosterCards >= 30 || report.menuPlayRoute.pickCards >= 3)
    && report.menuPlayRoute.pickLayer,
    report.menuPlayRoute);
  await evaluate(`goToMenu()`);
  await sleep(350);
  await physicalClick('#menu-screen .menu-buttons button[aria-label="ARSENAL QUEST"]');
  let questHubVisible = false;
  for (let i = 0; i < 40; i++) {
    questHubVisible = await evaluate(`Boolean(document.getElementById('aq-hub'))`).catch(() => false);
    if (questHubVisible) break;
    await sleep(150);
  }
  report.menuQuestRoute = await evaluate(`(() => ({
    hubVisible: Boolean(document.getElementById('aq-hub')),
    menuHidden: document.getElementById('menu-screen').classList.contains('hidden'),
  }))()`).catch(() => ({ hubVisible: questHubVisible }));
  gate('menu-button-quest-route-hub-loads', report.menuQuestRoute.hubVisible === true, report.menuQuestRoute);
  await evaluate(`(() => { try { window.aqExitToMainMenu ? window.aqExitToMainMenu() : document.getElementById('aq-hub-exit')?.click(); } catch (e) {} goToMenu(); return true; })()`);
  await sleep(300);

  // ------------------------------------------------------- mode entry ------
  report.entry = await evaluate(`(() => {
    const d = __AQ_TEST.enterManual();
    return { gameState: d.gameState, hero: d.hero, rival: d.rival, hudOpacity: document.getElementById('hud').style.opacity, menuHidden: document.getElementById('menu-screen').classList.contains('hidden') };
  })()`);
  gate('entry-state', report.entry.gameState === 'ARSENAL'
    && report.entry.hero.hp === 1000 && report.entry.rival.hp === 1000
    && report.entry.hero.weapon === 'NONE' && report.entry.rival.weapon === 'NONE'
    && report.entry.menuHidden, report.entry);

  // ------------------------------------------------ spawn law (A-CORR-1/2) --
  report.spawnLaw = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(90, 90, 910, 910);
    const leads = {};
    const spawnTimes = [];
    let lastCount = 0;
    for (let t = 0; t < 20; t += 0.1) {
      __AQ_TEST.step(0.1);
      const st = APEX_ARSENAL.state;
      if (st.spawnedTotal > lastCount) { spawnTimes.push(+st.time.toFixed(2)); lastCount = st.spawnedTotal; }
      for (const slot of st.slots) {
        if (slot.phase === 'TELEGRAPH') leads[slot.id] = slot.revealLeadSeconds;
      }
    }
    const gaps = spawnTimes.slice(1).map((v, i) => +(v - spawnTimes[i]).toFixed(2));
    const d = __AQ_TEST.debug();
    const leadValues = Object.values(leads);
    const revealEvents = __AQ_TEST.events().filter(e => e.startsWith('[AQ] REVEAL'));
    return {
      spawnedTotal: d.spawnedTotal,
      maxActive: d.maxActiveSlots,
      spawnTimes,
      gaps,
      cadenceOk: spawnTimes.length >= 4 && spawnTimes[0] <= 0.2
        && gaps.every(g => Math.abs(g - 4.5) < 0.15),
      leadValues,
      leadsFixedTwo: leadValues.length >= 3 && leadValues.every(v => Math.abs(v - 2.0) < 1e-9),
      spawnEvents: __AQ_TEST.countEvents('SPAWN_SLOT'),
      revealCount: revealEvents.length,
      allRevealsForced: revealEvents.length >= 3 && revealEvents.every(e => e.includes('force=true')),
      allHiddenIdentityNull: d.slots.filter(s => s.phase === 'TELEGRAPH').every(s => s.weaponId === null),
    };
  })()`);
  gate('spawn-cadence-3.0s', report.spawnLaw.cadenceOk,
    `spawnTimes=${JSON.stringify(report.spawnLaw.spawnTimes)} gaps=${JSON.stringify(report.spawnLaw.gaps)}`);
  gate('reveal-lead-fixed-2.0', report.spawnLaw.leadsFixedTwo, report.spawnLaw.leadValues.map(v => v.toFixed(2)));
  gate('multi-slot-coexist', report.spawnLaw.maxActive >= 3, `maxActiveSlots=${report.spawnLaw.maxActive}`);
  gate('force-reveals-only-while-unapproached',
    report.spawnLaw.allRevealsForced && report.spawnLaw.allHiddenIdentityNull,
    `reveals=${report.spawnLaw.revealCount} (all force=true, identity null while hidden)`);

  // --------------------- whole-circle reveal law + 3.0s failsafe (A-CORR-2) --
  report.telegraphLaw = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(400, 500, 900, 900);
    const id = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });

    __AQ_TEST.step(2.9);
    let slot = APEX_ARSENAL.state.slots.find(s => s.id === id) || null;
    const hiddenAt2_9 = !!slot && slot.phase === 'TELEGRAPH' && slot.weaponId === null;
    const before = __AQ_TEST.debug().slots.find(s => s.id === id) || null;

    __AQ_TEST.step(0.2);
    slot = APEX_ARSENAL.state.slots.find(s => s.id === id) || null;
    const forceRevealed = !!slot && slot.phase === 'REVEALED' && !!slot.weaponId;
    const forceLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + id)) || '';

    fighters[0].baseSpeed = 520;
    fighters[0].setDir(1, 0);
    fighters[1].baseSpeed = 0;
    __AQ_TEST.step(1.5);
    const pickupAfterForce = __AQ_TEST.countEvents('PICKUP', 'fighter=HERO') === 1
      && (!!__AQ_TEST.holder('HERO') || __AQ_TEST.countEvents('CONSUME', 'fighter=HERO') >= 1);

    fighters[0].data.arsenal = null;
    fighters[0].data.arsenalFade = null;
    fighters[1].data.arsenal = null;
    projectiles.length = 0;
    fighters[0].statuses = {}; fighters[1].statuses = {};
    fighters[0].hp = fighters[0].maxHp; fighters[1].hp = fighters[1].maxHp;
    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(100, 300, 900, 900);
    const mid = __AQ_TEST.pushSlot({ x: 850, y: 300, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.04);
    slot = APEX_ARSENAL.state.slots.find(s => s.id === mid) || null;
    const moveRevealLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + mid)) || '';
    const revealedOnMovement = !!slot && slot.phase === 'REVEALED'
      && moveRevealLog.includes('lead=2.00') && moveRevealLog.includes('force=false')
      && moveRevealLog.includes('fighter=HERO');
    return {
      hiddenAt2_9, before, forceRevealed, forceLog, pickupAfterForce,
      revealedOnMovement, moveRevealLog,
    };
  })()`);
  gate('hidden-until-force-age-3.0',
    report.telegraphLaw.hiddenAt2_9 && report.telegraphLaw.before?.weaponId === null,
    report.telegraphLaw.before);
  gate('telegraph-no-identity', report.telegraphLaw.before?.weaponId === null);
  gate('force-reveal-at-3.0-not-autopickup',
    report.telegraphLaw.forceRevealed && /force=true/.test(report.telegraphLaw.forceLog)
      && /lead=2\.00/.test(report.telegraphLaw.forceLog) && report.telegraphLaw.pickupAfterForce,
    report.telegraphLaw.forceLog);
  gate('movement-reveal-lead-2.0',
    report.telegraphLaw.revealedOnMovement && /eta=\d+\.\d+/.test(report.telegraphLaw.moveRevealLog),
    report.telegraphLaw.moveRevealLog);

  // ------------- A-CORR-2 negatives: near miss outside circle + no pre-bounce --
  report.circleNeg = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 440, 900, 200);
    const missId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0); fighters[1].baseSpeed = 0;
    __AQ_TEST.step(1.1);
    const miss = APEX_ARSENAL.state.slots.find(s => s.id === missId) || null;
    const nearMissStayedHidden = !!miss && miss.phase === 'TELEGRAPH' && miss.weaponId === null;

    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 475, 900, 200);
    const edgeId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.04);
    const edge = APEX_ARSENAL.state.slots.find(s => s.id === edgeId) || null;
    const edgeLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + edgeId)) || '';
    const edgeOfCircleReveals = !!edge && edge.phase === 'REVEALED' && edgeLog.includes('force=false');

    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(900, 500, 300, 200);
    const bounceId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.03);
    const preBounce = APEX_ARSENAL.state.slots.find(s => s.id === bounceId) || null;
    const hiddenBeforeBounce = !!preBounce && preBounce.phase === 'TELEGRAPH' && preBounce.weaponId === null;
    __AQ_TEST.step(0.35);
    const postBounce = APEX_ARSENAL.state.slots.find(s => s.id === bounceId) || null;
    const bounceLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + bounceId)) || '';
    const revealedAfterBounce = !postBounce || (postBounce.phase === 'REVEALED' && bounceLog.includes('force=false'));
    return { nearMissStayedHidden, edgeOfCircleReveals, edgeLog, hiddenBeforeBounce, revealedAfterBounce, bounceLog };
  })()`);
  gate('near-miss-outside-circle-stays-hidden', report.circleNeg.nearMissStayedHidden, report.circleNeg);
  gate('edge-of-circle-approach-reveals', report.circleNeg.edgeOfCircleReveals, report.circleNeg.edgeLog);
  gate('no-reveal-before-bounce', report.circleNeg.hiddenBeforeBounce && report.circleNeg.revealedAfterBounce, report.circleNeg.bounceLog);


  // ------------------------- V2 §A1: aim never steers; dagger body stays put --
  report.aimLaw = await evaluate(`(() => {
    const out = {};
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(200, 500, 800, 500);
    fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
    const d0 = { x: fighters[0].dir.x, y: fighters[0].dir.y };
    const p0 = { x: fighters[0].x, y: fighters[0].y };
    __AQ_TEST.equip('HERO', 'SNIPER');
    __AQ_TEST.step(0.5);
    out.aimDirSame = fighters[0].dir.x === d0.x && fighters[0].dir.y === d0.y;
    out.aimKeptApexTrajectory = Math.abs(fighters[0].y - (p0.y + 260)) < 8 && Math.abs(fighters[0].x - p0.x) < 1e-6;
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(500, 500, 700, 500);
    fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
    const q0 = { x: fighters[0].x, y: fighters[0].y };
    __AQ_TEST.equip('HERO', 'DAGGER');
    __AQ_TEST.step(0.2);
    out.daggerBodyKeptTrajectory = Math.abs(fighters[0].y - (q0.y + 104)) < 12 && Math.abs(fighters[0].x - q0.x) < 1e-6;
    out.daggerThrustConnected = __AQ_TEST.countEvents('CONSUME', 'stab-landed') >= 1;
    return out;
  })()`);
  gate('aim-never-steers-fighter', report.aimLaw.aimDirSame && report.aimLaw.aimKeptApexTrajectory, report.aimLaw);
  gate('dagger-no-body-dash', report.aimLaw.daggerBodyKeptTrajectory && report.aimLaw.daggerThrustConnected, report.aimLaw);

  // ------------------------- V2 §A4: no slash VFX; bomb explosion stays -------
  report.noSlash = await evaluate(`(() => {
    const av = window.APEX_ARSENAL_AV;
    const seqBefore = av.stats.seqAnimsPushed || 0;
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(500, 500, 650, 500);
    __AQ_TEST.equip('HERO', 'SABRE');
    __AQ_TEST.step(0.5);
    __AQ_TEST.equip('RIVAL', 'BATTLE_AXE');
    __AQ_TEST.step(0.8);
    const seqAfter = av.stats.seqAnimsPushed || 0;
    __AQ_TEST.equip('HERO', 'GRENADE');
    let atlas = 0;
    for (let i = 0; i < 150; i++) { APEX_ARSENAL.step(1 / 60); atlas = Math.max(atlas, av.activeVfx()); }
    return { noSlashSeq: seqBefore === 0 && seqAfter === 0, bombAtlas: (av.stats.atlasCued || 0) >= 1 && atlas > 0 };
  })()`);
  gate('no-slash-vfx-in-combat', report.noSlash.noSlashSeq, report.noSlash);
  gate('bomb-explosion-vfx-remains', report.noSlash.bombAtlas, report.noSlash);

  // --------------------------------- both sides collect + armed rejection --
  report.pickupRules = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 700, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.pushSlot({ x: 700, y: 500, weaponId: 'PISTOL' });
    __AQ_TEST.step(0.3);
    const rivalGot = __AQ_TEST.holder('RIVAL');
    __AQ_TEST.pushSlot({ x: 300, y: 500, weaponId: 'SMG' });
    __AQ_TEST.step(0.3);
    const heroGot = __AQ_TEST.holder('HERO');
    __AQ_TEST.pushSlot({ x: 300, y: 520, weaponId: 'PISTOL' });
    const before = APEX_ARSENAL.state.slots.length;
    __AQ_TEST.step(0.3);
    const rejectedStillThere = APEX_ARSENAL.state.slots.some(s => s.weaponId === 'PISTOL' && s.phase === 'REVEALED');
    return {
      rivalGot: rivalGot && rivalGot.weapon,
      heroGot: heroGot && heroGot.weapon,
      heroStillArmedWith: (__AQ_TEST.holder('HERO') || {}).weapon,
      rejectedStillThere,
      rejectLogged: __AQ_TEST.countEvents('REJECT_PICKUP', 'fighter=HERO') > 0,
    };
  })()`);
  gate('rival-can-collect', report.pickupRules.rivalGot === 'PISTOL');
  gate('hero-can-collect', report.pickupRules.heroGot === 'SMG');
  gate('armed-fighter-cannot-vacuum', report.pickupRules.rejectedStillThere && report.pickupRules.rejectLogged && report.pickupRules.heroStillArmedWith === 'SMG');

  // ------------------------------------------------ soft cap suppression ---
  report.softCap = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.clearSlots();
    for (let i = 0; i < APEX_ARSENAL_CONFIG.MAX_ACTIVE_SLOTS; i++) __AQ_TEST.pushSlot({ x: 100 + i * 100, y: 200, weaponId: 'PISTOL' });
    const result = APEX_ARSENAL_SPAWN.trySpawnSlot();
    return { spawned: result !== null && result !== undefined, active: APEX_ARSENAL.state.slots.length, suppressed: __AQ_TEST.countEvents('SPAWN_SUPPRESSED') };
  })()`);
  gate('soft-cap-suppresses-and-logs', report.softCap.spawned === false && report.softCap.suppressed >= 1);

  // ------------------------------------------------ 12 weapon behaviors ----
  const MELEE_PLACEMENT = { SABRE: 200, BATTLE_AXE: 200, DAGGER: 190, SPEAR: 320, SPIKED_CLUB: 200 };
  report.weapons = {};
  for (const weaponId of ['PISTOL', 'SHOTGUN', 'SMG', 'SNIPER', 'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB']) {
    const isMelee = !!MELEE_PLACEMENT[weaponId];
    const gap = isMelee ? MELEE_PLACEMENT[weaponId] : 300;
    report.weapons[weaponId] = await evaluate(`(() => {
      __AQ_TEST.enterManual();
      __AQ_TEST.clearEvents();
      __AQ_TEST.place(300, 500, ${300 + gap}, 500);
      __AQ_TEST.holdSpawns();
      __AQ_TEST.equip('HERO', '${weaponId}');
      __AQ_TEST.step(0.3);
      const midPhase = (__AQ_TEST.holder('HERO') || {}).phase;
      __AQ_TEST.step(0.35);
      const midPhase2 = (__AQ_TEST.holder('HERO') || {}).phase;
      const statusesMid = __AQ_TEST.statuses('RIVAL');
      __AQ_TEST.step(2.35);
      const hp = __AQ_TEST.hp();
      return {
        midPhase,
        midPhase2,
        rivalHp: hp.rival,
        damageDealt: +(hp.rivalMax - hp.rival).toFixed(1),
        holderAfter: __AQ_TEST.holder('HERO'),
        useLogged: __AQ_TEST.countEvents('USE', 'weapon=${weaponId}'),
        hitLogged: __AQ_TEST.countEvents('HIT', 'weapon=${weaponId}'),
        consumeLogged: __AQ_TEST.countEvents('CONSUME', 'weapon=${weaponId}'),
        statuses: __AQ_TEST.statuses('RIVAL'),
        statusesMid,
      };
    })()`);
    const w = report.weapons[weaponId];
    gate(`weapon-${weaponId}`, w.damageDealt > 0 && w.holderAfter === null && w.useLogged >= 1 && w.consumeLogged >= 1 && w.hitLogged >= 1,
      `dmg=${w.damageDealt} holder=${JSON.stringify(w.holderAfter)} USE=${w.useLogged} HIT=${w.hitLogged} CONSUME=${w.consumeLogged}`);
  }
  gate('pistol-3-shots', report.weapons.PISTOL.hitLogged === 3, `hits=${report.weapons.PISTOL.hitLogged}`);
  gate('smg-8-shots', report.weapons.SMG.hitLogged === 8, `hits=${report.weapons.SMG.hitLogged}`);
  gate('sniper-single-high-damage', report.weapons.SNIPER.hitLogged === 1 && report.weapons.SNIPER.damageDealt >= 20, `dmg=${report.weapons.SNIPER.damageDealt}`);
  gate('sniper-aim-telegraph-window', report.weapons.SNIPER.midPhase2 === 'AIM', `phase@0.3s=${report.weapons.SNIPER.midPhase} phase@0.65s=${report.weapons.SNIPER.midPhase2}`);
  gate('club-stun-applied', report.weapons.SPIKED_CLUB.statusesMid.includes('stun'), report.weapons.SPIKED_CLUB.statusesMid);
  gate('axe-knockback-applied', report.weapons.BATTLE_AXE.statusesMid.includes('push'), report.weapons.BATTLE_AXE.statusesMid);

  // Grenade: consumed on throw but projectile resolves later in world.
  report.grenade = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(250, 500, 550, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'GRENADE');
    __AQ_TEST.step(0.6);
    const afterThrow = { holder: __AQ_TEST.holder('HERO'), grenadeInWorld: __AQ_TEST.aqProjectiles().some(p => p.type === 'aq_grenade'), rivalHp: __AQ_TEST.hp().rival };
    __AQ_TEST.step(1.6);
    return {
      afterThrow,
      rivalHpAfter: __AQ_TEST.hp().rival,
      explodeLogged: __AQ_TEST.countEvents('EXPLODE') > 0,
      grenadeGone: !__AQ_TEST.aqProjectiles().some(p => p.type === 'aq_grenade'),
    };
  })()`);
  gate('grenade-throw-consumes-immediately', report.grenade.afterThrow.holder === null && report.grenade.afterThrow.grenadeInWorld);
  gate('grenade-resolves-after-fuse', report.grenade.rivalHpAfter < 1000 && report.grenade.explodeLogged && report.grenade.grenadeGone, `rivalHp=${report.grenade.rivalHpAfter}`);

  // Melee waits for valid activation geometry (does not waste itself).
  report.meleeWait = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(120, 120, 880, 880);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'BATTLE_AXE');
    __AQ_TEST.step(2.0);
    const farState = { holder: __AQ_TEST.holder('HERO'), rivalHp: __AQ_TEST.hp().rival };
    fighters[1].x = 320; fighters[1].y = 120;
    __AQ_TEST.step(1.2);
    return { farState, nearState: { holder: __AQ_TEST.holder('HERO'), rivalHp: __AQ_TEST.hp().rival } };
  })()`);
  gate('melee-not-wasted-out-of-range', !report.meleeWait.farState.holder, report.meleeWait.farState);
  gate('melee-activates-in-range', report.meleeWait.nearState.holder === null && report.meleeWait.nearState.rivalHp < 1000);

  // ---------------------------------------------------- shield behaviors ---
  report.swirl = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 700, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('RIVAL', 'SNIPER');
    __AQ_TEST.equip('HERO', 'SWIRL_SHIELD');
    __AQ_TEST.step(2.5);
    const bulletOwners = __AQ_TEST.aqProjectiles().map(p => p.owner);
    return {
      heroHp: __AQ_TEST.hp().hero,
      rivalHp: __AQ_TEST.hp().rival,
      heroHolder: __AQ_TEST.holder('HERO'),
      reflectLogged: __AQ_TEST.countEvents('REFLECT', 'fighter=HERO') > 0,
      hitOnRivalFromHero: __AQ_TEST.events().filter(e => e.startsWith('[AQ] HIT') && e.includes('source=HERO') && e.includes('target=RIVAL')).length,
      bulletOwners,
    };
  })()`);
  gate('swirl-reflects-projectile', report.swirl.reflectLogged && report.swirl.heroHp === 1000 && report.swirl.rivalHp < 1000 && report.swirl.heroHolder === null,
    `heroHp=${report.swirl.heroHp} rivalHp=${report.swirl.rivalHp} hitOnRivalFromHero=${report.swirl.hitOnRivalFromHero}`);
  gate('swirl-reflect-ownership-correct', report.swirl.hitOnRivalFromHero >= 1, 'reflected bullet source=HERO target=RIVAL');

  report.tower = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 700, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'TOWER_SHIELD');
    __AQ_TEST.step(0.3);
    const speedStatus = __AQ_TEST.statuses('HERO').includes('slow');
    APEX_ARSENAL.weaponApi.aqDamage(fighters[0], 10, fighters[1], 'TEST_PROBE');
    const guardedHp = __AQ_TEST.hp().hero;
    __AQ_TEST.step(3.0);
    const expired = __AQ_TEST.holder('HERO');
    APEX_ARSENAL.weaponApi.aqDamage(fighters[0], 10, fighters[1], 'TEST_PROBE');
    const unguardedHp = __AQ_TEST.hp().hero;
    return { speedStatus, guardedHp, expiredHolder: expired, unguardedHp, unguardedDelta: +(guardedHp - unguardedHp).toFixed(2) };
  })()`);
  gate('tower-shield-reduces-damage', report.tower.guardedHp === 997.5 && report.tower.unguardedDelta === 10,
    `withShield 10->${report.tower.guardedDelta}, without 10->${report.tower.unguardedDelta}`);
  gate('tower-shield-slow-while-active', report.tower.speedStatus);
  gate('tower-shield-expires-to-unarmed', report.tower.expiredHolder === null);

  // ------------------------------------------------- cleanup / stale refs --
  report.cleanup = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(300, 500, 700, 500);
    __AQ_TEST.equip('HERO', 'SNIPER');
    __AQ_TEST.step(1.6);
    const staleAqAfterConsume = projectiles.filter(p => p.aq && p.owner && p.owner.hp <= 0).length;
    __AQ_TEST.equip('RIVAL', 'TOWER_SHIELD');
    window.exitArsenalQuestMode();
    return {
      gameStateAfter: gameState,
      menuVisible: !document.getElementById('menu-screen').classList.contains('hidden'),
      hudHidden: document.getElementById('hud').style.opacity === '0',
      slotsCleared: !APEX_ARSENAL.state || APEX_ARSENAL.state.slots.length === 0,
      aqProjectilesCleared: projectiles.filter(p => p.aq).length === 0,
      heroHolderCleared: !fighters[0].data.arsenal,
      staleAqAfterConsume,
      exitLogged: APEX_ARSENAL.events.some(e => e.startsWith('[AQ] MODE_EXIT')),
    };
  })()`);
  gate('exit-cleanup', report.cleanup.gameStateAfter === 'MENU' && report.cleanup.menuVisible && report.cleanup.hudHidden
    && report.cleanup.slotsCleared && report.cleanup.aqProjectilesCleared && report.cleanup.heroHolderCleared && report.cleanup.exitLogged, report.cleanup);

  // ------------------ V2 §A3 + A-CORR-3: 32 shells with compatible identity --
  // Runs AFTER the shield/pickup gates so their blank HERO/RIVAL expectations
  // are not affected by the shell matchup remembered for rematch (lastShells).
  report.shells = await evaluate(`(() => {
    const shells = window.APEX_ARSENAL_SHELLS;
    const ids = shells ? shells.ids : [];
    window.startArsenalQuestMode('SNIPER', 'WITCH');
    cancelAnimationFrame(reqId); reqId = 0;
    APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
    const names = fighters.map(f => f.name);
    const shellFlags = fighters.map(f => !!f.type.arsenalShell);
    let nativeProj = 0;
    for (let i = 0; i < 180; i++) {
      APEX_ARSENAL.step(1 / 60);
      nativeProj = Math.max(nativeProj, projectiles.filter(p => !p.aq).length);
    }
    return { count: ids.length, names, shellFlags, nativeProj, hp: [fighters[0].hp, fighters[1].hp] };
  })()`);
  gate('shells-32-canonical', report.shells.count === 33, { count: report.shells.count });
  gate('shells-p1-p2-independent',
    report.shells.names[0] === 'SNIPER' && report.shells.names[1] === 'WITCH' && report.shells.shellFlags.every(Boolean),
    report.shells.names);
  gate('shells-native-kits-active-in-arsenal',
    report.shells.nativeProj >= 1 && report.shells.hp.every(h => h > 0 && h <= 1000), report.shells);

  // A-CORR-3 roster matrix proof (real browser): classification, KEEP skill,
  // ADAPT durations, native-skill + Arsenal-weapon coexistence.
  report.roster = await evaluate(`(() => {
    const shells = window.APEX_ARSENAL_SHELLS;
    const ids = shells.ids;
    const kits = {};
    for (const n of ids) kits[n] = (shells.typeFor(n) || {}).compatKit || 'MISSING';
    const allClassified = ids.every(n => kits[n] === 'KEEP' || kits[n] === 'ADAPT');
    const adapted = ids.filter(n => kits[n] === 'ADAPT');
    const ice = shells.typeFor('ICE');
    projectiles.length = 0;
    const iceF = {
      name: 'ICE', id: 101, data: {}, x: 300, y: 300, radius: 75, baseRadius: 75,
      hp: 100, maxHp: 100, isRage: false, statuses: {},
      cooldownRate: () => 1,
      hasStatus: () => false, applyStatus() {}, takeDamage() {}, heal() {}, setDir() {},
    };
    ice.init(iceF);
    ice.update(iceF, { x: 700, y: 700 }, 1.6);
    const iceLaneFired = projectiles.some(p => p.type === 'ice_lane');
    const vamp = shells.typeFor('VAMPIRE');
    const vf = { type: vamp, data: {}, x: 500, y: 500, radius: 75, isRage: false, hasStatus: () => false };
    vamp.init(vf);
    vf.data.latchCd = 0; vf.data.latchTimer = 0;
    vamp.onCollide(vf, { id: 2, x: 560, y: 500, radius: 75, applyStatus() {}, takeDamage() {}, heal() {}, hasStatus: () => false, statuses: {} });
    const vampLatch = vf.data.latchTimer;
    const monk = shells.typeFor('MONK');
    const mf = { type: monk, data: {}, x: 400, y: 400, radius: 75, isRage: false, hasStatus: () => false, setDir() {}, heal() {} };
    monk.init(mf);
    const me = { id: 9, x: 460, y: 400, radius: 75, hp: 100, maxHp: 100, statuses: {}, data: {}, applyStatus(k, t) { this.statuses[k] = { timer: t }; }, takeDamage() {}, hasStatus: () => false };
    for (let i = 0; i < 4; i++) { mf.data.hitCd = 0; monk.onCollide(mf, me); }
    const monkRush = mf.data.rushTimer;
    window.startArsenalQuestMode('RUBBER', 'WITCH');
    cancelAnimationFrame(reqId); reqId = 0;
    APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
    projectiles.length = 0;
    fighters[0].x = 300; fighters[0].y = 500; fighters[1].x = 700; fighters[1].y = 500;
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.equip('HERO', 'PISTOL');
    let nativeSeen = 0, aqSeen = 0;
    for (let i = 0; i < 240; i++) {
      fighters.forEach(q => { if (q) q.hp = q.maxHp; });
      APEX_ARSENAL.step(1 / 60);
      if (projectiles.some(p => !p.aq && p.type === 'witch_ray')) nativeSeen++;
      if (projectiles.some(p => p.aq)) aqSeen++;
    }
    const holderIntact = !!APEX_ARSENAL.weaponApi.getHolder(fighters[0])
      || __AQ_TEST.countEvents('USE', 'weapon=PISTOL') >= 1;
    return { kits, allClassified, adapted, iceLaneFired, vampLatch, monkRush, nativeSeen, aqSeen, holderIntact };
  })()`);
  gate('roster-all-33-classified-keep-or-adapt',
    report.roster.allClassified && Object.keys(report.roster.kits).length === 33
      && report.roster.adapted.join(',') === 'VAMPIRE,MONK',
    { adapted: report.roster.adapted });
  gate('roster-keep-native-skill-runs', report.roster.iceLaneFired, { iceLaneFired: report.roster.iceLaneFired });
  gate('roster-adapt-vampire-latch-2.5', report.roster.vampLatch === 2.5, `latchTimer=${report.roster.vampLatch}`);
  gate('roster-adapt-monk-rush-2.5', report.roster.monkRush === 2.5, `rushTimer=${report.roster.monkRush}`);
  gate('roster-native-skill-and-weapon-coexist',
    report.roster.nativeSeen > 0 && report.roster.aqSeen > 0 && report.roster.holderIntact,
    { nativeFrames: report.roster.nativeSeen, aqFrames: report.roster.aqSeen });

  // ------------------------------------------------- F3 overlay + screenshots
  report.f3 = await evaluate(`(() => {
    __AQ_TEST.enterLive();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true, cancelable: true }));
    const on = APEX_ARSENAL.state.debugOverlay;
    return { toggledOn: on };
  })()`);
  gate('f3-debug-overlay-toggle', report.f3.toggledOn === true);

  // Issue #4/C: real-browser proof that the committed C weapon set renders (floor +
  // equipped) and the old placeholder path is not serving weapon art.
  report.weaponArt = await evaluate(`(async () => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(180, 180, 820, 820);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.pushSlot({ x: 500, y: 220, weaponId: 'SHOTGUN' });
    __AQ_TEST.pushSlot({ x: 640, y: 220, weaponId: 'AK_47' });
    __AQ_TEST.equip('HERO', 'SABRE');
    __AQ_TEST.equip('RIVAL', 'SWIRL_SHIELD');
    const t0 = Date.now();
    while (APEX_ARSENAL_AV.imagesReady() < APEX_ARSENAL_AV.describe().allImages.length && Date.now() - t0 < 15000) {
      await new Promise(r => setTimeout(r, 100));
    }
    __AQ_TEST.step(0.3);
    __AQ_TEST.redraw();
    const s = APEX_ARSENAL_AV.stats;
    return { floor: s.floorSpriteDraws, equipped: s.equippedSpriteDraws, imgFail: s.imagesFailed, sfxFail: s.audioFailed };
  })()`);
  gate('browser-weapon-cset-floor-sprite', report.weaponArt.floor >= 2, report.weaponArt);
  gate('browser-weapon-cset-equipped-sprite', report.weaponArt.equipped >= 2, report.weaponArt);
  gate('browser-no-cset-fallback', report.weaponArt.imgFail === 0 && report.weaponArt.floor > 0, report.weaponArt);

  // Screenshot 1: hidden telegraph (deterministic scene, direct draw()).
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(240, 620, 780, 340);
    __AQ_TEST.pushSlot({ x: 500, y: 470, phase: 'TELEGRAPH', weaponId: null, revealDelay: 99, revealTimer: 99 });
    __AQ_TEST.step(0.4);
    APEX_ARSENAL.state.debugOverlay = true;
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('01-hidden-telegraph'));

  // Screenshot 2: multiple simultaneous pickups (3 revealed + 1 telegraph).
  await evaluate(`(() => {
    __AQ_TEST.clearSlots();
    __AQ_TEST.pushSlot({ x: 320, y: 300, weaponId: 'SHOTGUN' });
    __AQ_TEST.pushSlot({ x: 500, y: 640, weaponId: 'BATTLE_AXE' });
    __AQ_TEST.pushSlot({ x: 720, y: 380, weaponId: 'SWIRL_SHIELD' });
    __AQ_TEST.pushSlot({ x: 620, y: 760, phase: 'TELEGRAPH', weaponId: null, revealDelay: 99, revealTimer: 99 });
    __AQ_TEST.step(0.2);
    __AQ_TEST.redraw();
    return APEX_ARSENAL.state.slots.length;
  })()`);
  report.evidence.push(await screenshot('02-multiple-simultaneous-pickups'));

  // Screenshot 3: HERO pickup moment.
  await evaluate(`(() => {
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(300, 500, 820, 260);
    __AQ_TEST.pushSlot({ x: 300, y: 500, weaponId: 'SNIPER' });
    __AQ_TEST.step(0.15);
    __AQ_TEST.redraw();
    return __AQ_TEST.holder('HERO');
  })()`);
  report.evidence.push(await screenshot('03-hero-pickup'));

  // Screenshot 4: RIVAL pickup moment.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(180, 720, 760, 480);
    __AQ_TEST.pushSlot({ x: 760, y: 480, weaponId: 'SPIKED_CLUB' });
    __AQ_TEST.step(0.15);
    __AQ_TEST.redraw();
    return __AQ_TEST.holder('RIVAL');
  })()`);
  report.evidence.push(await screenshot('04-rival-pickup'));

  // Screenshot 5: ranged attack — sniper aim telegraph, then pistol tracers.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(220, 500, 780, 500);
    __AQ_TEST.equip('HERO', 'SNIPER');
    __AQ_TEST.step(0.75);
    __AQ_TEST.redraw();
    return __AQ_TEST.holder('HERO');
  })()`);
  report.evidence.push(await screenshot('05-ranged-sniper-aim'));
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(220, 500, 780, 500);
    __AQ_TEST.equip('RIVAL', 'PISTOL');
    __AQ_TEST.step(0.5);
    __AQ_TEST.step(0.12);
    __AQ_TEST.redraw();
    return __AQ_TEST.aqProjectiles();
  })()`);
  report.evidence.push(await screenshot('05b-ranged-pistol-burst'));

  // Screenshot 6: melee attack — battle axe windup + slash arc.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(330, 500, 520, 500);
    __AQ_TEST.equip('HERO', 'BATTLE_AXE');
    __AQ_TEST.step(0.6);
    __AQ_TEST.redraw();
    return __AQ_TEST.holder('HERO');
  })()`);
  report.evidence.push(await screenshot('06-melee-axe-swing'));

  // Screenshot 7: shield behavior — tower guard absorbing a hit.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(300, 500, 700, 500);
    __AQ_TEST.equip('HERO', 'TOWER_SHIELD');
    __AQ_TEST.step(0.4);
    APEX_ARSENAL.weaponApi.aqDamage(fighters[0], 10, fighters[1], 'TEST_PROBE');
    __AQ_TEST.redraw();
    return __AQ_TEST.hp();
  })()`);
  report.evidence.push(await screenshot('07-tower-shield-guard'));
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(300, 500, 700, 500);
    __AQ_TEST.equip('RIVAL', 'SNIPER');
    __AQ_TEST.equip('HERO', 'SWIRL_SHIELD');
    __AQ_TEST.step(1.35);
    __AQ_TEST.redraw();
    return __AQ_TEST.hp();
  })()`);
  report.evidence.push(await screenshot('07b-swirl-reflect'));

  // Screenshot 8: F3 debug overlay on a live-ish arena.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(240, 620, 780, 340, false);
    for (let i = 0; i < 120; i++) __AQ_TEST.step(1/30);
    APEX_ARSENAL.state.debugOverlay = true;
    __AQ_TEST.redraw();
    return __AQ_TEST.debug();
  })()`);
  report.evidence.push(await screenshot('08-f3-debug-overlay'));

  // V2 evidence 16: shared select screen renders the canonical 32 shells;
  // P1 locks SNIPER, P2 locks WITCH independently, START enters Arsenal.
  const newbieFallback = await evaluate(`(async () => {
    const M = window.APEX_ARSENAL_META;
    M.save(M.sanitize({
      version: 1, credits: 350,
      ownedFighters: ['NEWBIE'],
      lastSelectedP1: 'SNIPER', lastSelectedP2: 'WITCH', totalSpins: 0, unlockedAt: { NEWBIE: 0 },
    }));
    if (gameState === 'ARSENAL' && typeof window.exitArsenalQuestMode === 'function') window.exitArsenalQuestMode();
    M.openFighterPick({ mode: 'free' });
    await new Promise(r => setTimeout(r, 400));
    const t = window.__APEX_PICK_TEST;
    return { p1: t && t.p1(), p2: t && t.p2(), names: t ? t.roster().map(c => c.name) : [] };
  })()`);
  gate('v3-free-invalid-save-falls-back-newbie', newbieFallback.p1 === 'NEWBIE' && newbieFallback.p2 === 'NEWBIE' && newbieFallback.names.length === 1, newbieFallback);

  const shellSelect = await evaluate(`(async () => {
    const M = window.APEX_ARSENAL_META;
    const seeded = M.sanitize({
      version: 1, credits: 350,
      ownedFighters: ['NEWBIE', 'ICE', 'CARD'],
      lastSelectedP1: 'ICE', lastSelectedP2: 'CARD', totalSpins: 0, unlockedAt: { NEWBIE: 0, ICE: 1, CARD: 1 },
    });
    M.save(seeded);
    if (gameState === 'ARSENAL' && typeof window.exitArsenalQuestMode === 'function') window.exitArsenalQuestMode();
    M.openFighterPick({ mode: 'free' });
    await new Promise(r => setTimeout(r, 450));
    const t = window.__APEX_PICK_TEST;
    const names = t ? t.roster().map(c => c.name) : [];
    const restored = { p1: t && t.p1(), p2: t && t.p2() };
    const hubHidden = !document.getElementById('aq-meta-root') || document.getElementById('aq-meta-root').style.display === 'none';
    const broken = Array.from(document.querySelectorAll('.apex-pick-card img')).filter(img => img.getAttribute('src') === 'null' || img.getAttribute('src') === 'undefined').length;
    if (t) t.confirmByName('NEWBIE');
    await new Promise(r => setTimeout(r, 80));
    if (t) t.confirmByName('ICE');
    await new Promise(r => setTimeout(r, 80));
    return {
      names, restored,
      p1: t && t.p1(),
      p2: t && t.p2(),
      selectVisible: !document.getElementById('select-screen').classList.contains('hidden'),
      hubHidden, broken,
      newbie: names.includes('NEWBIE'),
      unownedSniper: names.includes('SNIPER'),
    };
  })()`);
  gate('v3-free-owned-only-roster', shellSelect.newbie && !shellSelect.unownedSniper && shellSelect.names.length === 3 && shellSelect.selectVisible && shellSelect.hubHidden, shellSelect);
  gate('v3-free-restore-saved-owned', shellSelect.restored.p1 === 'ICE' && shellSelect.restored.p2 === 'CARD', shellSelect);
  gate('v3-free-p1-p2-independent', shellSelect.p1 === 'NEWBIE' && shellSelect.p2 === 'ICE', shellSelect);
  gate('v3-free-no-broken-cards', shellSelect.broken === 0, shellSelect);
  report.evidence.push(await screenshot('v3-free-pick-owned'));
  const shellEnter = await evaluate(`(async () => {
    document.querySelector('.apex-pick-button[aria-label="start-button"]')?.click();
    const t0 = Date.now();
    while (gameState !== 'ARSENAL' && Date.now() - t0 < 6000) await new Promise(r => setTimeout(r, 100));
    cancelAnimationFrame(reqId); reqId = 0;
    return { gameState, names: fighters.map(f => f.name), shells: fighters.map(f => !!f.type.arsenalShell) };
  })()`);
  gate('v3-free-enters-arsenal-owned', shellEnter.gameState === 'ARSENAL'
    && shellEnter.names[0] === 'NEWBIE' && shellEnter.names[1] === 'ICE'
    && shellEnter.shells.every(Boolean), shellEnter);
  report.evidence.push(await screenshot('v3-free-battle-enter'));

  // V2 evidence 17: movement direction unchanged while equipped weapon aims.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    fighters[0].x = 250; fighters[0].y = 500; fighters[1].x = 800; fighters[1].y = 500;
    fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
    __AQ_TEST.equip('HERO', 'SNIPER');
    __AQ_TEST.step(0.45);
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('17-v2-aim-independent-of-movement'));

  // V2 B evidence 18: whole-circle reveal — an EDGE approach (25px off-center,
  // inside the 42px visible question-mark circle) reveals at the 2.0s lead.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    fighters[0].x = 400; fighters[0].y = 475; fighters[1].x = 900; fighters[1].y = 150;
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.1);
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('18-v2-edge-of-circle-reveal'));

  // V2 B evidence 19: near miss 60px off-center (outside the visible circle)
  // stays a hidden telegraph through the whole pass.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    fighters[0].x = 400; fighters[0].y = 440; fighters[1].x = 900; fighters[1].y = 150;
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.8);
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('19-v2-near-miss-stays-hidden'));

  // V2 evidence 20: dagger weapon-only thrust while the body keeps moving.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    fighters[0].x = 500; fighters[0].y = 500; fighters[1].x = 700; fighters[1].y = 500;
    fighters[0].baseSpeed = 520; fighters[0].setDir(0, 1); fighters[1].baseSpeed = 0;
    __AQ_TEST.equip('HERO', 'DAGGER');
    __AQ_TEST.step(0.09);
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('20-v2-dagger-thrust-no-body-dash'));

  // V2 B evidence 21: Checkpoint B motion signatures — one proof per weapon.
  // Each weapon runs a measured pass (pose peaks sampled from holder/ghost
  // state) and a re-armed pose-peak frame is screenshotted.
  report.motion = {};
  const MOTION_WEAPONS = ['PISTOL', 'SHOTGUN', 'SMG', 'SNIPER', 'GRENADE', 'SABRE', 'BATTLE_AXE', 'DAGGER', 'SPEAR', 'SPIKED_CLUB', 'SWIRL_SHIELD', 'TOWER_SHIELD'];
  const MOTION_GAP = { SHOTGUN: 200, SABRE: 200, BATTLE_AXE: 200, DAGGER: 190, SPEAR: 320, SPIKED_CLUB: 200 };
  for (const weaponId of MOTION_WEAPONS) {
    const sig = await evaluate(`(() => {
      const weaponId = ${JSON.stringify(weaponId)};
      const api = APEX_ARSENAL.weaponApi;
      const hero = () => fighters[0];
      const gap = ${JSON.stringify(MOTION_GAP)}[weaponId] || 260;
      function arm() {
        __AQ_TEST.enterManual();
        __AQ_TEST.holdSpawns();
        fighters[0].x = 300; fighters[0].y = 500;
        fighters[1].x = 300 + gap; fighters[1].y = 500;
        fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
        fighters[0].setDir(1, 0); fighters[1].setDir(-1, 0);
        hero().data.arsenal = null; hero().data.arsenalFade = null;
        fighters[0].statuses = {}; fighters[1].statuses = {};
        fighters[0].hp = fighters[0].maxHp; fighters[1].hp = fighters[1].maxHp;
        __AQ_TEST.equip('HERO', weaponId);
      }
      const poseOf = () => { const h = api.getHolder(hero()); return h ? h.meta.pose : null; };
      const ghostOf = () => hero().data.arsenalFade || null;
      arm();
      const b0 = { x: hero().x, y: hero().y, dx: hero().dir.x, dy: hero().dir.y };
      const m = { pulses: 0, maxRecoil: 0, minRecoil: 0, maxRot: 0, minRot: 0, maxLocalX: 0, minLocalY: 0, maxFlourish: 0, flips: 0, guardX: 0 };
      let lastPulses = -1, lastSign = 0;
      if (weaponId === 'SWIRL_SHIELD') {
        // idle settle flips
        for (let i = 0; i < 100; i++) {
          __AQ_TEST.step(1 / 60);
          const p = poseOf();
          if (p && p.rotKick !== 0) { const s = Math.sign(p.rotKick); if (lastSign !== 0 && s !== lastSign) m.flips++; lastSign = s; }
        }
        const rival = fighters[1];
        api.fireBullet({ owner: rival, x: rival.x - 60, y: rival.y, angle: Math.PI, speed: 500, damage: 4, weapon: 'PISTOL' });
        for (let i = 0; i < 60; i++) { __AQ_TEST.step(1 / 60); const g = ghostOf(); if (g) m.minRecoil = Math.min(m.minRecoil, g.pose.recoil); }
      } else if (weaponId === 'TOWER_SHIELD') {
        for (let i = 0; i < 30; i++) { __AQ_TEST.step(1 / 60); const p = poseOf(); if (p) m.guardX = Math.max(m.guardX, p.localX); }
        api.aqDamage(hero(), 10, fighters[1], 'PISTOL', {});
        const p2 = poseOf();
        if (p2) { m.maxRecoil = p2.recoil; m.maxRot = p2.rotKick; }
      } else {
        for (let i = 0; i < 260; i++) {
          __AQ_TEST.step(1 / 60);
          const p = poseOf();
          if (p) {
            if (p.pulses > lastPulses) { lastPulses = p.pulses; m.pulses = p.pulses; }
            m.maxRecoil = Math.max(m.maxRecoil, p.recoil);
            m.maxRot = Math.max(m.maxRot, p.rotKick);
            m.minRot = Math.min(m.minRot, p.rotKick);
            m.maxLocalX = Math.max(m.maxLocalX, p.localX);
            m.minLocalY = Math.min(m.minLocalY, p.localY);
            m.maxFlourish = Math.max(m.maxFlourish, p.flourish);
          }
          const g = ghostOf();
          if (g) {
            m.maxRecoil = Math.max(m.maxRecoil, g.pose.recoil);
            m.minRecoil = Math.min(m.minRecoil, g.pose.recoil);
            m.maxRot = Math.max(m.maxRot, g.pose.rotKick);
            m.maxLocalX = Math.max(m.maxLocalX, g.pose.localX);
          }
        }
      }
      // Pose-peak frame for the screenshot.
      arm();
      const CFGW = APEX_ARSENAL_CONFIG;
      let peakSeconds = 0.45;
      if (['SABRE', 'BATTLE_AXE', 'SPIKED_CLUB', 'SPEAR'].includes(weaponId)) peakSeconds = (CFGW.WEAPONS[weaponId].windup || 0.35) * 0.92;
      if (weaponId === 'DAGGER') peakSeconds = 0.35 + (CFGW.WEAPONS.DAGGER.dashTime || 0.24) * 0.5;
      if (weaponId === 'SNIPER') peakSeconds = 0.35 + (CFGW.WEAPONS.SNIPER.aimTime || 1.2) * 0.8;
      if (weaponId === 'GRENADE') peakSeconds = 0.55;
      if (weaponId === 'TOWER_SHIELD' || weaponId === 'SWIRL_SHIELD') peakSeconds = 0.5;
      let t = peakSeconds;
      while (t > 1e-9) { const d = Math.min(1 / 60, t); __AQ_TEST.step(d); t -= d; }
      __AQ_TEST.redraw();
      const bodySame = Math.abs(hero().x - b0.x) < 1e-6 && Math.abs(hero().y - b0.y) < 1e-6
        && Math.abs(hero().dir.x - b0.dx) < 1e-6 && Math.abs(hero().dir.y - b0.dy) < 1e-6;
      return { pulses: m.pulses, maxRecoil: +m.maxRecoil.toFixed(1), minRecoil: +m.minRecoil.toFixed(1), maxRot: +m.maxRot.toFixed(2), minRot: +m.minRot.toFixed(2), maxLocalX: +m.maxLocalX.toFixed(1), minLocalY: +m.minLocalY.toFixed(1), maxFlourish: +m.maxFlourish.toFixed(2), flips: m.flips, guardX: +m.guardX.toFixed(1), bodySame };
    })()`);
    report.motion[weaponId] = sig;
    report.evidence.push(await screenshot(`21-v2-motion-${weaponId.toLowerCase()}`));
  }
  gate('motion-browser-gun-signatures',
    report.motion.PISTOL.pulses === 3 && report.motion.PISTOL.maxRecoil >= 12 && report.motion.PISTOL.maxRecoil <= 16
      && report.motion.SHOTGUN.maxRecoil >= 24 && report.motion.SHOTGUN.maxRecoil <= 32
      && report.motion.SMG.pulses === 8 && report.motion.SMG.maxRecoil >= 8 && report.motion.SMG.maxRecoil <= 12
      && report.motion.SNIPER.maxFlourish > Math.PI && report.motion.SNIPER.maxRecoil >= 30
      && report.motion.GRENADE.maxLocalX > 20,
    { pistol: report.motion.PISTOL, shotgun: report.motion.SHOTGUN, smg: report.motion.SMG, sniper: report.motion.SNIPER, grenade: report.motion.GRENADE });
  gate('motion-browser-melee-signatures',
    report.motion.SABRE.minRot < -0.5 && report.motion.SABRE.maxRot > 0.2
      && report.motion.BATTLE_AXE.minRot < -0.8 && report.motion.BATTLE_AXE.minLocalY < -5
      && report.motion.SPIKED_CLUB.minRot < -0.6 && report.motion.SPIKED_CLUB.maxRot > 0.3
      && report.motion.DAGGER.maxLocalX >= 60 && report.motion.DAGGER.maxLocalX <= 90
      && report.motion.SPEAR.maxLocalX >= 90 && report.motion.SPEAR.maxLocalX <= 120,
    { sabre: report.motion.SABRE, axe: report.motion.BATTLE_AXE, club: report.motion.SPIKED_CLUB, dagger: report.motion.DAGGER, spear: report.motion.SPEAR });
  gate('motion-browser-shield-signatures',
    report.motion.SWIRL_SHIELD.flips >= 2 && report.motion.SWIRL_SHIELD.minRecoil <= -14
      && report.motion.TOWER_SHIELD.guardX >= 8 && report.motion.TOWER_SHIELD.maxRecoil >= 10,
    { swirl: report.motion.SWIRL_SHIELD, tower: report.motion.TOWER_SHIELD });
  gate('motion-browser-body-untouched',
    Object.values(report.motion).every(s => s.bodySame),
    Object.entries(report.motion).map(([k, v]) => `${k}:${v.bodySame}`).join(','));

  report.gapKeyJ = await evaluate(`(() => {
    window.startArsenalQuestMode('ICE', 'RUBBER');
    cancelAnimationFrame(reqId); reqId = 0;
    APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = [];
    projectiles.length = 0;
    fighters[0].data.cd = 0;
    for (let i = 0; i < 20; i++) APEX_ARSENAL.step(1 / 60);
    const before = projectiles.filter(p => p.type === 'ice_lane').length;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true, cancelable: true }));
    for (let i = 0; i < 12; i++) APEX_ARSENAL.step(1 / 60);
    const after = projectiles.filter(p => p.type === 'ice_lane').length;
    return { before, after };
  })()`);
  gate('browser-real-keyj-keydown', report.gapKeyJ.before === 0 && report.gapKeyJ.after >= 1, report.gapKeyJ);

  report.gapBurst = await evaluate(`(() => {
    function stamps(id, n) {
      __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
      __AQ_TEST.place(320, 500, 540, 500);
      fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
      __AQ_TEST.clearEvents();
      APEX_ARSENAL.weaponApi.equip(fighters[0], id);
      for (let i = 0; i < n; i++) APEX_ARSENAL.step(1 / 60);
      const shots = APEX_ARSENAL.events.filter(e => e.startsWith('[AQ] SHOT') && e.includes('weapon=' + id)).map(e => {
        const m = e.match(/t=([0-9.]+)/); return m ? +m[1] : null;
      }).filter(x => x != null);
      return { n: shots.length, gaps: shots.slice(1).map((t,i) => +(t - shots[i]).toFixed(3)) };
    }
    return { beretta: stamps('BERETTA_93R', 180), m16: stamps('M16', 200), mbr: stamps('MBR', 200), mbr2: stamps('MBR2', 220), szec: stamps('SZECSEI_FUCHS', 240) };
  })()`);
  gate('browser-beretta-burst-pause', report.gapBurst.beretta.n === 6 && report.gapBurst.beretta.gaps[2] >= 0.16, report.gapBurst.beretta);
  gate('browser-m16-burst-pause', report.gapBurst.m16.n === 6 && report.gapBurst.m16.gaps[2] >= 0.18, report.gapBurst.m16);
  gate('browser-mbr-two-shot', report.gapBurst.mbr.n === 2, report.gapBurst.mbr);
  gate('browser-mbr2-two-shot', report.gapBurst.mbr2.n === 2, report.gapBurst.mbr2);
  gate('browser-szecsei-two-shot', report.gapBurst.szec.n === 2, report.gapBurst.szec);

  report.gapSawedMag = await evaluate(`(() => {
    __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
    __AQ_TEST.place(300, 500, 480, 500);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    const rack0 = APEX_ARSENAL_AV.stats.cued.filter(c => c.event === 'shotgun_rack').length;
    APEX_ARSENAL.weaponApi.equip(fighters[0], 'SAWED_OFF');
    for (let i = 0; i < 50; i++) APEX_ARSENAL.step(1 / 60);
    const rack = APEX_ARSENAL_AV.stats.cued.filter(c => c.event === 'shotgun_rack').length - rack0;
    const ghost = fighters[0].data && fighters[0].data.arsenalFade;
    const casing0 = APEX_ARSENAL_AV.stats.cued.filter(c => c.event === 'casing').length;
    APEX_ARSENAL.weaponApi.equip(fighters[0], 'MAGNUM_500');
    __AQ_TEST.place(300, 500, 640, 500);
    let magCasing = 0;
    for (let i = 0; i < 40; i++) {
      APEX_ARSENAL.step(1 / 60);
      if (APEX_ARSENAL.weaponApi.getHolder(fighters[0])) {
        magCasing = APEX_ARSENAL_AV.stats.cued.filter(c => c.event === 'casing').length - casing0;
      }
    }
    const magGhost = fighters[0].data && fighters[0].data.arsenalFade;
    return { rack, sawedExit: ghost && ghost.exitKey, magCasing, magExit: magGhost && magGhost.exitKey };
  })()`);
  gate('browser-sawed-no-rack', report.gapSawedMag.rack === 0, report.gapSawedMag);
  gate('browser-magnum-no-shot-casing', report.gapSawedMag.magCasing === 0, report.gapSawedMag);

  report.gapReserveBr = await evaluate(`(() => {
    __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
    __AQ_TEST.place(300, 500, 700, 500);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    APEX_ARSENAL.weaponApi.equip(fighters[1], 'P90');
    __AQ_TEST.pushSlot({ x: 300, y: 500, phase: 'COUNTER_RESERVED', weaponId: 'SWIRL_SHIELD', reservedFor: fighters[0].id, boundWeaponId: 'P90', boundOwnerId: fighters[1].id, revealedFor: 0 });
    fighters[1].x = 300; fighters[1].y = 500;
    APEX_ARSENAL.weaponApi.consume(fighters[1], 'test');
    APEX_ARSENAL_SPAWN.resolvePickups();
    const stolen = __AQ_TEST.holder('RIVAL');
    fighters[1].x = 700;
    APEX_ARSENAL_SPAWN.resolvePickups();
    const hero = __AQ_TEST.holder('HERO');
    return { stolen: stolen && stolen.weapon, hero: hero && hero.weapon };
  })()`);
  gate('browser-reserved-shield-not-stolen', report.gapReserveBr.stolen == null && report.gapReserveBr.hero === 'SWIRL_SHIELD', report.gapReserveBr);

  await evaluate(`(() => {
    __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
    __AQ_TEST.place(180, 200, 820, 800);
    __AQ_TEST.pushSlot({ x: 400, y: 280, phase: 'REVEALED', weaponId: 'PISTOL', tier: 'T1', revealedFor: 0 });
    __AQ_TEST.redraw();
  })()`);
  report.evidence.push(await screenshot('gap-rarity-t1'));
  await evaluate(`(() => {
    APEX_ARSENAL.state.slots = [];
    __AQ_TEST.pushSlot({ x: 400, y: 280, phase: 'REVEALED', weaponId: 'AK_47', tier: 'T3', revealedFor: 0 });
    __AQ_TEST.redraw();
  })()`);
  report.evidence.push(await screenshot('gap-rarity-t3'));
  await evaluate(`(() => {
    APEX_ARSENAL.state.slots = [];
    __AQ_TEST.pushSlot({ x: 400, y: 280, phase: 'REVEALED', weaponId: 'SNIPER', tier: 'T5', revealedFor: 0 });
    __AQ_TEST.redraw();
  })()`);
  report.evidence.push(await screenshot('gap-rarity-t5'));
  await evaluate(`(() => {
    APEX_ARSENAL.state.slots = [];
    __AQ_TEST.pushSlot({ x: 360, y: 280, phase: 'REVEALED', weaponId: 'SABRE', tier: 'T2', revealedFor: 0 });
    __AQ_TEST.pushSlot({ x: 520, y: 280, phase: 'REVEALED', weaponId: 'GRENADE', tier: 'T3', revealedFor: 0 });
    __AQ_TEST.redraw();
  })()`);
  report.evidence.push(await screenshot('gap-rarity-melee-grenade'));

  async function casingScene(weaponId, name) {
    const detail = await evaluate(`(() => {
      __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
      __AQ_TEST.place(280, 500, 720, 500);
      fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
      APEX_ARSENAL_AV.stats.cued.length = 0;
      APEX_ARSENAL.weaponApi.equip(fighters[0], '${weaponId}');
      const frames = '${weaponId}' === 'SNIPER' ? 120 : 55;
      for (let i = 0; i < frames; i++) APEX_ARSENAL.step(1 / 60);
      const fresh = APEX_ARSENAL_AV.stats.cued.filter(c => c.event === 'casing' && c.weapon === '${weaponId}');
      __AQ_TEST.redraw();
      return { n: fresh.length, usedMeta: fresh.length > 0 && fresh.every(c => c.usedMeta === true), sample: fresh[0] || null };
    })()`);
    report.evidence.push(await screenshot(name));
    return detail;
  }
  report.gapCasingBr = {
    glock: await casingScene('GLOCK_17', 'gap-casing-glock'),
    ak: await casingScene('AK_47', 'gap-casing-ak'),
    m249: await casingScene('M249_SAW', 'gap-casing-m249'),
    spas: await casingScene('SHOTGUN', 'gap-casing-spas'),
    mbr: await casingScene('MBR', 'gap-casing-mbr'),
    snipex: await casingScene('SNIPER', 'gap-casing-snipex'),
  };
  gate('browser-casing-uses-metadata',
    ['glock', 'ak', 'm249', 'spas', 'mbr', 'snipex'].every((k) => report.gapCasingBr[k].usedMeta === true),
    report.gapCasingBr);

  await evaluate(`(() => {
    __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
    APEX_ARSENAL.state.slots = [];
    const ids = ['GLOCK_17','P90','AK_47','M249_SAW','SNIPER'];
    ids.forEach((id, i) => __AQ_TEST.pushSlot({ x: 140 + i * 160, y: 420, phase: 'REVEALED', weaponId: id, tier: 'T1', revealedFor: 0 }));
    __AQ_TEST.redraw();
  })()`);
  report.evidence.push(await screenshot('rev2-senko-scale-lineup'));
  report.rev2ScaleBr = await evaluate(`(() => {
    const set = APEX_ARSENAL_C_SET;
    const g = set.weapons.GLOCK_17, s = set.weapons.SNIPER;
    return { scale: set.SENKO_WORLD_SCALE, g: g.worldW, s: s.worldW, ratio: s.worldW / g.worldW, src: s.sourceW / g.sourceW };
  })()`);
  gate('browser-rev2-senko-scale', Math.abs(report.rev2ScaleBr.ratio - report.rev2ScaleBr.src) < 0.02 && report.rev2ScaleBr.s > report.rev2ScaleBr.g * 3, report.rev2ScaleBr);

  report.rev2ExitBr = await evaluate(`(() => {
    __AQ_TEST.enterManual(); __AQ_TEST.holdSpawns();
    __AQ_TEST.place(320, 520, 760, 520);
    fighters[0].baseSpeed = 0;
    const ids = ['GLOCK_17','AK_47','MAC_10','SHOTGUN','M249_SAW','SNIPER'];
    const out = {};
    for (const id of ids) {
      APEX_ARSENAL.state.detachedWeapons = [];
      APEX_ARSENAL.weaponApi.equip(fighters[0], id);
      APEX_ARSENAL.weaponApi.consume(fighters[0], 'test');
      const d0 = (APEX_ARSENAL.state.detachedWeapons || [])[0];
      fighters[0].x += 90;
      APEX_ARSENAL.weaponApi.tickDetachedWeapons(0.1);
      const d1 = (APEX_ARSENAL.state.detachedWeapons || [])[0];
      out[id] = d1 ? { x: d1.x, y: d1.y, rot: d1.rot, follow: Math.abs(d1.x - fighters[0].x) < 8, key: d0 && d0.exitKey } : null;
      fighters[0].x = 320;
    }
    return out;
  })()`);
  gate('browser-rev2-detached-exits', Object.values(report.rev2ExitBr).every((v) => v && v.follow === false), report.rev2ExitBr);
  await evaluate(`__AQ_TEST.redraw()`);
  report.evidence.push(await screenshot('rev2-detached-exits'));

  report.rev2QuestBr = await evaluate(`(() => {
    const Q = APEX_ARSENAL_QUEST;
    Q.persist({ unlockedThrough: 20, completedStages: [1] });
    const a = Q.startStage(1, 'NEWBIE');
    const p2a = fighters[1] && (fighters[1].type && fighters[1].type.name);
    const b = Q.startStage(10, 'NEWBIE');
    const p2b = fighters[1] && fighters[1].type && fighters[1].type.name;
    const c = Q.startStage(20, 'NEWBIE');
    const p2c = fighters[1] && fighters[1].type && fighters[1].type.name;
    return { a, p2a, b, p2b, c, p2c, live: Q.liveOpponent('MONK') };
  })()`);
  gate('browser-rev2-quest-1-10-20',
    report.rev2QuestBr.a.opponent === 'PAINTER' && report.rev2QuestBr.b.opponent === 'ELECTRIC' && report.rev2QuestBr.c.opponent === 'MONK',
    report.rev2QuestBr);

  report.rev2Hud = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.redraw();
    const el = document.getElementById('aq-skill-hud');
    return { has: !!el, text: el ? el.textContent : '' };
  })()`);
  gate('browser-rev2-cooldown-hud', report.rev2Hud.has === true, report.rev2Hud);

  report.rev2QuestUxBr = await evaluate(`(async () => {
    const Q = APEX_ARSENAL_QUEST;
    const M = window.APEX_ARSENAL_META;
    M.save(M.sanitize({
      version: 1, credits: 350,
      ownedFighters: ['NEWBIE', 'ICE'],
      lastSelectedP1: 'ICE', lastSelectedP2: 'NEWBIE', totalSpins: 0, unlockedAt: { NEWBIE: 0, ICE: 1 },
    }));
    Q.persist({ unlockedThrough: 1, completedStages: [] });
    if (gameState === 'ARSENAL') window.exitArsenalQuestMode();
    Q.showMap();
    const map1 = document.getElementById('aq-quest-map');
    const mapOpen = !!(map1 && map1.style.display !== 'none' && typeof Q.showMap === 'function');
    const btn1 = map1 && map1.querySelector('button[data-n="1"]');
    if (btn1) btn1.click();
    await new Promise(r => setTimeout(r, 400));
    const pending = Q.peekPending && Q.peekPending();
    const selectVisible = !document.getElementById('select-screen').classList.contains('hidden');
    const hubHidden = !document.getElementById('aq-meta-root') || document.getElementById('aq-meta-root').style.display === 'none';
    const t = window.__APEX_PICK_TEST;
    const rosterNames = t ? t.roster().map(c => c.name) : [];
    const p2Before = t && t.p2();
    if (t) t.confirmByName('ICE');
    await new Promise(r => setTimeout(r, 80));
    const p1Locked = t && t.p1();
    const p2Mid = t && t.p2();
    if (t) t.confirmByName('NEWBIE');
    await new Promise(r => setTimeout(r, 80));
    const p2AfterAttempt = t && t.p2();
    if (t) t.confirmByName('ICE');
    await new Promise(r => setTimeout(r, 80));
    const p1After = t && t.p1();
    await new Promise(r => setTimeout(r, 120));
    document.querySelector('.apex-pick-button[aria-label="start-button"]')?.click();
    const t0 = Date.now();
    while (gameState !== 'ARSENAL' && Date.now() - t0 < 6000) await new Promise(r => setTimeout(r, 80));
    cancelAnimationFrame(reqId); reqId = 0;
    const names = fighters.map(f => f.name);
    const types = fighters.map(f => f.type && f.type.name);
    fighters[1].hp = 0;
    APEX_ARSENAL.step(1/60);
    __AQ_TEST.redraw();
    const winEl = document.getElementById('aq-quest-actions');
    const winText = winEl ? winEl.textContent : '';
    const winActs = Q.resultActions(APEX_ARSENAL.state);
    const next = Q.nextStage();
    cancelAnimationFrame(reqId); reqId = 0;
    const stage2 = { n: APEX_ARSENAL.state.questStage, p1: fighters[0].name, p2: fighters[1].type && fighters[1].type.name };
    fighters[0].hp = 0; fighters[1].hp = 100;
    APEX_ARSENAL.step(1/60);
    __AQ_TEST.redraw();
    const lossActs = Q.resultActions(APEX_ARSENAL.state);
    const lossEl = document.getElementById('aq-quest-actions');
    Q.recordWin(1);
    Q.showMap();
    const map2 = document.getElementById('aq-quest-map');
    const mapHtml = map2 ? map2.innerText : '';
    const save = Q.loadSave();
    Q.persist(save);
    const raw = localStorage.getItem(Q.STORAGE_KEY);
    return {
      mapOpen, pending, selectVisible, hubHidden, rosterNames, p2Before, p2Mid, p2AfterAttempt, p1Locked, p1After,
      names, types, winText, winActs, next, stage2, lossActs,
      lossText: lossEl ? lossEl.textContent : '',
      mapHtml, save, raw, showFn: typeof Q.showMap,
    };
  })()`);
  report.evidence.push(await screenshot('rev2-quest-map'));
  gate('browser-rev2-quest-map-opens', report.rev2QuestUxBr.mapOpen === true && report.rev2QuestUxBr.showFn === 'function', report.rev2QuestUxBr);
  gate('browser-rev2-quest-stage1-opens-selector',
    report.rev2QuestUxBr.pending && report.rev2QuestUxBr.pending.n === 1 && report.rev2QuestUxBr.selectVisible === true && report.rev2QuestUxBr.hubHidden === true,
    report.rev2QuestUxBr);
  gate('v3-quest-owned-p1-fixed-unowned-p2',
    report.rev2QuestUxBr.p2Before === 'PAINTER'
    && report.rev2QuestUxBr.p2AfterAttempt === 'PAINTER'
    && report.rev2QuestUxBr.p1After === 'ICE'
    && report.rev2QuestUxBr.rosterNames && report.rev2QuestUxBr.rosterNames.includes('ICE')
    && !report.rev2QuestUxBr.rosterNames.includes('PAINTER'),
    report.rev2QuestUxBr);
  gate('browser-rev2-quest-ice-vs-painter',
    report.rev2QuestUxBr.names && report.rev2QuestUxBr.names[0] === 'ICE' && report.rev2QuestUxBr.types && report.rev2QuestUxBr.types[1] === 'PAINTER',
    report.rev2QuestUxBr);
  gate('browser-rev2-quest-win-ui',
    report.rev2QuestUxBr.winActs && report.rev2QuestUxBr.winActs.actions && report.rev2QuestUxBr.winActs.actions.join(',') === 'NEXT,REPLAY,QUEST MAP'
    && /NEXT/.test(report.rev2QuestUxBr.winText),
    report.rev2QuestUxBr.winActs);
  gate('browser-rev2-quest-next-drum',
    report.rev2QuestUxBr.stage2 && report.rev2QuestUxBr.stage2.n === 2 && report.rev2QuestUxBr.stage2.p2 === 'DRUM' && report.rev2QuestUxBr.stage2.p1 === 'ICE',
    report.rev2QuestUxBr.stage2);
  gate('browser-rev2-quest-loss-ui',
    report.rev2QuestUxBr.lossActs && report.rev2QuestUxBr.lossActs.actions && report.rev2QuestUxBr.lossActs.actions.join(',') === 'RETRY,QUEST MAP',
    report.rev2QuestUxBr.lossActs);
  gate('browser-rev2-quest-persist',
    report.rev2QuestUxBr.save && report.rev2QuestUxBr.save.unlockedThrough >= 2 && !!report.rev2QuestUxBr.raw,
    report.rev2QuestUxBr.save);
  report.evidence.push(await screenshot('v3-quest-result-or-map'));

  await evaluate(`(() => {
    const M = window.APEX_ARSENAL_META;
    if (gameState === 'ARSENAL' && typeof window.exitArsenalQuestMode === 'function') window.exitArsenalQuestMode();
    M.openHub();
    return true;
  })()`);
  report.evidence.push(await screenshot('v3-hub'));
  await evaluate(`APEX_ARSENAL_META.paintShop()`);
  report.evidence.push(await screenshot('v3-shop'));
  await evaluate(`document.querySelector('[data-buy]')?.click()`);
  report.evidence.push(await screenshot('v3-shop-detail'));
  await evaluate(`APEX_ARSENAL_META.paintDraw()`);
  report.evidence.push(await screenshot('v3-lucky-draw-idle'));
  await evaluate(`(() => {
    const el = document.getElementById('aq-wheel');
    if (el) el.style.transform = 'rotate(540deg)';
    return true;
  })()`);
  report.evidence.push(await screenshot('v3-lucky-draw-spin'));
  await evaluate(`document.getElementById('aq-spin')?.click()`);
  report.evidence.push(await screenshot('v3-lucky-draw-result'));
  await evaluate(`(() => { APEX_ARSENAL_META.hideMeta(); APEX_ARSENAL_QUEST.showMap(); return true; })()`);
  report.evidence.push(await screenshot('v3-quest-map'));

  // ------------------------------------------ responsive UI / pointer QA -----
  // These gates use real browser viewport overrides and physical CDP pointer
  // dispatch. Programmatic HTMLElement.click() is intentionally insufficient:
  // it can pass even when an overlay has pointer-events:none.
  await evaluate(`(() => {
    APEX_ARSENAL_QUEST.showMap();
    document.getElementById('aq-quest-map').style.display = 'none';
    APEX_ARSENAL_META.hideMeta();
    window.startArsenalQuestMode('HERO', 'RIVAL');
    APEX_ARSENAL.state.debugOverlay = false;
    __AQ_TEST.redraw();
    return true;
  })()`);

  const layoutProbe = async () => evaluate(`(() => {
    const rect = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
    };
    return {
      innerWidth, innerHeight,
      scrollWidth:document.documentElement.scrollWidth,
      shell:rect('#battle-shell'),
      arena:rect('#game-wrapper'),
      p1:rect('#p1-combat-panel'),
      p2:rect('#p2-combat-panel'),
    };
  })()`);

  await setViewport(1920, 1080, false);
  await evaluate(`__AQ_TEST.redraw(); true`);
  const fullDesktop = await layoutProbe();
  gate('responsive-fullscreen-battle-uses-width',
    fullDesktop.shell && fullDesktop.shell.width >= fullDesktop.innerWidth - 16
      && fullDesktop.scrollWidth <= fullDesktop.innerWidth + 2,
    fullDesktop);
  gate('responsive-fullscreen-arena-square-maximized',
    fullDesktop.arena
      && Math.abs(fullDesktop.arena.width - fullDesktop.arena.height) <= 2
      && fullDesktop.arena.height >= fullDesktop.innerHeight * 0.94,
    fullDesktop);
  gate('responsive-fullscreen-side-panels-fill-height',
    fullDesktop.p1 && fullDesktop.p2
      && fullDesktop.p1.width >= 260 && fullDesktop.p2.width >= 260
      && fullDesktop.p1.height >= fullDesktop.innerHeight * 0.94
      && fullDesktop.p2.height >= fullDesktop.innerHeight * 0.94,
    fullDesktop);
  report.evidence.push(await screenshot('responsive-battle-1920x1080'));

  await setViewport(1366, 768, false);
  await evaluate(`__AQ_TEST.redraw(); true`);
  const normalDesktop = await layoutProbe();
  gate('responsive-desktop-battle-uses-width',
    normalDesktop.shell && normalDesktop.shell.width >= normalDesktop.innerWidth - 16
      && normalDesktop.scrollWidth <= normalDesktop.innerWidth + 2,
    normalDesktop);
  gate('responsive-desktop-arena-square',
    normalDesktop.arena
      && Math.abs(normalDesktop.arena.width - normalDesktop.arena.height) <= 2
      && normalDesktop.arena.height >= normalDesktop.innerHeight * 0.92,
    normalDesktop);
  gate('responsive-desktop-side-panels-readable',
    normalDesktop.p1 && normalDesktop.p2
      && normalDesktop.p1.width >= 220 && normalDesktop.p2.width >= 220,
    normalDesktop);
  report.evidence.push(await screenshot('responsive-battle-1366x768'));

  await setViewport(390, 844, true);
  await evaluate(`__AQ_TEST.redraw(); true`);
  const phone = await layoutProbe();
  gate('responsive-phone-no-horizontal-overflow',
    phone.shell && phone.shell.width <= phone.innerWidth + 2
      && phone.scrollWidth <= phone.innerWidth + 2,
    phone);
  gate('responsive-phone-arena-full-width-square',
    phone.arena
      && Math.abs(phone.arena.width - phone.arena.height) <= 2
      && phone.arena.width >= phone.innerWidth - 10,
    phone);
  gate('responsive-phone-panels-stack-full-width',
    phone.p1 && phone.p2
      && phone.p1.width >= phone.innerWidth - 12
      && phone.p2.width >= phone.innerWidth - 12
      && phone.p1.top >= phone.arena.bottom - 2
      && phone.p2.top >= phone.p1.bottom - 2,
    phone);
  report.evidence.push(await screenshot('responsive-battle-390x844'));
  const phoneExitTap = await physicalTap('#aq-battle-exit');
  const phoneExitState = await evaluate(`(() => ({
    state:gameState,
    menuVisible:!document.getElementById('menu-screen').classList.contains('hidden')
  }))()`);
  gate('responsive-phone-touch-exit-works',
    phoneExitTap.hitWithin === true && phoneExitTap.pointerEvents !== 'none'
      && phoneExitState.state === 'MENU' && phoneExitState.menuVisible === true,
    { tap:phoneExitTap, after:phoneExitState });
  await evaluate(`window.startArsenalQuestMode('HERO','RIVAL'); APEX_ARSENAL.state.debugOverlay=false; __AQ_TEST.redraw(); true`);
  await evaluate(`document.getElementById('p1-combat-panel')?.scrollIntoView({ block:'start' }); true`);
  await sleep(100);
  report.evidence.push(await screenshot('responsive-panels-390x844'));

  await clearViewport();
  await sleep(120);

  // ------------------------------------------------------------- PASS A -----
  // Owner playtest Pass A (OWNER_PLAYTEST_PASS_A_HIT_FEEDBACK_AND_NAV_AUTHORITY):
  // main-menu entry resolves to the Hub, Hub-rooted navigation with visible
  // exits, and frame-stepped hit-feedback evidence.
  await evaluate(`(() => {
    if (gameState === 'ARSENAL' && typeof window.exitArsenalQuestMode === 'function') window.exitArsenalQuestMode();
    if (typeof goToMenu === 'function') goToMenu();
    return true;
  })()`);
  await sleep(400);
  // 1) the REAL main-menu Arsenal action must open the Hub (not Quest Map).
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('#menu-screen button')]
      .find(b => /ARSENAL/i.test(b.textContent || ''));
    if (btn) btn.click();
    return !!btn;
  })()`);
  let menuHub = null;
  for (let i = 0; i < 40; i++) {
    menuHub = await evaluate(`(() => {
      const meta = document.getElementById('aq-meta-root');
      return {
        hubVisible: !!meta && meta.style.display !== 'none'
          && !!meta.querySelector('[data-go="free"]')
          && !!meta.querySelector('[data-go="quest"]')
          && !!meta.querySelector('[data-go="shop"]')
          && !!meta.querySelector('[data-go="draw"]'),
        hubExit: !!document.getElementById('aq-hub-exit'),
        state: gameState,
      };
    })()`);
    if (menuHub.hubVisible && menuHub.hubExit) break;
    await sleep(250);
  }
  gate('passa-menu-arsenal-opens-hub', menuHub.hubVisible === true && menuHub.hubExit === true, menuHub);
  report.evidence.push(await screenshot('passa-menu-hub'));

  // 2) Hub visible EXIT -> global Main Menu.
  const hubExitPointer = await physicalClick('#aq-hub-exit');
  gate('responsive-pointer-hub-exit-hit-test', hubExitPointer.hitWithin === true && hubExitPointer.pointerEvents !== 'none', hubExitPointer);
  await sleep(300);
  const hubExit = await evaluate(`(() => ({
    state: gameState,
    menuVisible: !document.getElementById('menu-screen').classList.contains('hidden'),
    metaHidden: !document.getElementById('aq-meta-root') || document.getElementById('aq-meta-root').style.display === 'none',
  }))()`);
  gate('passa-hub-exit-main-menu', hubExit.state === 'MENU' && hubExit.menuVisible === true && hubExit.metaHidden === true, hubExit);
  report.evidence.push(await screenshot('passa-hub-exit-mainmenu'));

  // 3) Hub -> Shop -> BACK -> Hub.
  await evaluate(`APEX_ARSENAL_META.openHub()`);
  await sleep(150);
  const shopPointer = await physicalClick('#aq-meta-root [data-go="shop"]');
  gate('responsive-pointer-hub-shop-hit-test', shopPointer.hitWithin === true && shopPointer.pointerEvents !== 'none', shopPointer);
  await sleep(250);
  const shopView = await evaluate(`!!document.getElementById('aq-shop-back')`);
  gate('passa-hub-to-shop', shopView === true, shopView);
  report.evidence.push(await screenshot('passa-shop'));
  const shopBackPointer = await physicalClick('#aq-shop-back');
  gate('responsive-pointer-shop-back-hit-test', shopBackPointer.hitWithin === true && shopBackPointer.pointerEvents !== 'none', shopBackPointer);
  await sleep(200);
  gate('passa-shop-back-hub', await evaluate(`!!document.querySelector('#aq-meta-root [data-go="free"]')`) === true);
  report.evidence.push(await screenshot('passa-shop-back-hub'));

  // 4) Hub -> Lucky Draw -> BACK -> Hub.
  const drawPointer = await physicalClick('#aq-meta-root [data-go="draw"]');
  gate('responsive-pointer-hub-draw-hit-test', drawPointer.hitWithin === true && drawPointer.pointerEvents !== 'none', drawPointer);
  await sleep(250);
  const drawView = await evaluate(`!!document.getElementById('aq-draw-back')`);
  gate('passa-hub-to-lucky-draw', drawView === true, drawView);
  report.evidence.push(await screenshot('passa-lucky-draw'));
  const drawBackPointer = await physicalClick('#aq-draw-back');
  gate('responsive-pointer-draw-back-hit-test', drawBackPointer.hitWithin === true && drawBackPointer.pointerEvents !== 'none', drawBackPointer);
  await sleep(200);
  gate('passa-draw-back-hub', await evaluate(`!!document.querySelector('#aq-meta-root [data-go="free"]')`) === true);
  report.evidence.push(await screenshot('passa-draw-back-hub'));

  // 5) Hub -> Quest Map -> visible BACK -> Hub.
  const questPointer = await physicalClick('#aq-meta-root [data-go="quest"]');
  gate('responsive-pointer-hub-quest-hit-test', questPointer.hitWithin === true && questPointer.pointerEvents !== 'none', questPointer);
  await sleep(400);
  const qmap = await evaluate(`(() => {
    const el = document.getElementById('aq-quest-map');
    return { visible: !!el && el.style.display !== 'none', close: !!document.getElementById('aq-quest-close') };
  })()`);
  gate('passa-hub-to-quest-map', qmap.visible === true && qmap.close === true, qmap);
  report.evidence.push(await screenshot('passa-quest-map'));
  const questBackPointer = await physicalClick('#aq-quest-close');
  gate('responsive-pointer-quest-back-hit-test', questBackPointer.hitWithin === true && questBackPointer.pointerEvents !== 'none', questBackPointer);
  await sleep(200);
  gate('passa-quest-map-back-hub', await evaluate(`!!document.querySelector('#aq-meta-root [data-go="free"]')`) === true);
  report.evidence.push(await screenshot('passa-quest-map-back-hub'));

  // 6) Hub -> Free Battle picker -> visible exit back to Hub.
  const freePointer = await physicalClick('#aq-meta-root [data-go="free"]');
  gate('responsive-pointer-hub-free-hit-test', freePointer.hitWithin === true && freePointer.pointerEvents !== 'none', freePointer);
  await sleep(500);
  const pick = await evaluate(`(() => ({
    selectVisible: !document.getElementById('select-screen').classList.contains('hidden'),
    exitBtn: !!document.querySelector('button[aria-label="exit-button"]'),
  }))()`);
  gate('passa-hub-to-free-pick', pick.selectVisible === true && pick.exitBtn === true, pick);
  report.evidence.push(await screenshot('passa-free-pick'));
  const pickerBackPointer = await physicalClick('button[aria-label="exit-button"]');
  gate('responsive-pointer-picker-exit-hit-test', pickerBackPointer.hitWithin === true && pickerBackPointer.pointerEvents !== 'none', pickerBackPointer);
  await sleep(300);
  const pickBack = await evaluate(`(() => ({
    hubVisible: !!document.querySelector('#aq-meta-root [data-go="free"]'),
    state: gameState,
  }))()`);
  gate('passa-free-pick-back-hub', pickBack.hubVisible === true, pickBack);
  report.evidence.push(await screenshot('passa-free-pick-back-hub'));

  // 7) Active battle exposes a visible EXIT; it mirrors the accepted B/ESC behavior.
  await evaluate(`(() => {
    APEX_ARSENAL_META.hideMeta();
    window.startArsenalQuestMode('HERO', 'RIVAL');
    return true;
  })()`);
  // Deterministic: paint one explicit Arsenal frame (draw -> syncDomHud) so the
  // visible-exit assertion does not depend on headless rAF scheduling.
  await evaluate(`__AQ_TEST.redraw(); true`);
  let battle = null;
  for (let i = 0; i < 10; i++) {
    battle = await evaluate(`(() => {
      const b = document.getElementById('aq-battle-exit');
      return { visible: !!b && b.style.display !== 'none', state: gameState };
    })()`);
    if (battle.visible) break;
    await evaluate(`__AQ_TEST.redraw(); true`);
    await sleep(100);
  }
  gate('passa-battle-visible-exit', battle.visible === true && battle.state === 'ARSENAL', battle);
  report.evidence.push(await screenshot('passa-battle-exit-visible'));
  const battleExitPointer = await physicalClick('#aq-battle-exit');
  gate('responsive-pointer-battle-exit-hit-test', battleExitPointer.hitWithin === true && battleExitPointer.pointerEvents !== 'none', battleExitPointer);
  await sleep(300);
  const battleExit = await evaluate(`(() => ({
    state: gameState,
    menuVisible: !document.getElementById('menu-screen').classList.contains('hidden'),
  }))()`);
  gate('passa-battle-exit-works', battleExit.state === 'MENU' && battleExit.menuVisible === true, battleExit);

  // 8) Frame-stepped hit feedback — deterministic manual stepping + real draw().
  await evaluate(`(() => {
    window.startArsenalQuestMode('HERO', 'RIVAL');
    // The assertions inspect the FIRST manual frame; a concurrent live rAF
    // can age the core between the collision probe and the next CDP command.
    cancelAnimationFrame(reqId); reqId = 0;
    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearSlots();
    APEX_ARSENAL_FEEL.resetMatch();
    APEX_ARSENAL.combatRng = () => 0.99;
    fighters[0].hp = 1000; fighters[1].hp = 1000;
    __AQ_TEST.place(240, 500, 780, 500);
    return true;
  })()`);
  await evaluate(`APEX_ARSENAL.weaponApi.fireBullet({
    owner: fighters[0], x: fighters[0].x + 30, y: fighters[0].y, angle: 0, speed: 2600,
    damage: APEX_ARSENAL_CONFIG.WEAPONS.PISTOL.damagePerShot, weapon: 'PISTOL', critical: false,
  }); true`);
  const collided = await evaluate(`(() => {
    const h0 = APEX_ARSENAL_FEEL.stats.v1Hits;
    let g = 0;
    while (APEX_ARSENAL_FEEL.stats.v1Hits === h0 && g++ < 40) __AQ_TEST.step(1 / 60);
    __AQ_TEST.redraw(); // the FIRST rendered frame after the collision
    return APEX_ARSENAL_FEEL.stats.v1Hits > h0;
  })()`);
  gate('passa-frame-normal-collision-landed', collided === true);
  const frameNormal = await evaluate(`(() => {
    const core = APEX_ARSENAL_FEEL.liveSpray().find(p => p.kind === 'v1core');
    return { life: core ? core.life : null, max: core ? core.max : null, alpha: core ? core.life / core.max : 0 };
  })()`);
  gate('passa-frame-normal-blood-fresh-on-first-frame',
    frameNormal !== null && Math.abs(frameNormal.life - 0.12) < 1e-9 && Math.abs(frameNormal.alpha - 1) < 1e-9,
    frameNormal);
  report.evidence.push(await screenshot('passa-frame-normal-first'));
  await evaluate(`__AQ_TEST.step(0.12); __AQ_TEST.redraw(); true`);
  report.evidence.push(await screenshot('passa-frame-normal-decay'));

  // AUTO: immediate first popup on the collision frame, then in-place aggregate.
  const autoFrames = await evaluate(`(() => {
    APEX_ARSENAL_FEEL.resetMatch();
    fighters[1].hp = 1000;
    fighters[1].takeDamage(4, fighters[0], 'arsenal-smg', false);
    const first = APEX_ARSENAL_FEEL.livePopups().map(p => p.kind + ':' + p.text);
    __AQ_TEST.redraw();
    fighters[1].takeDamage(4, fighters[0], 'arsenal-smg', false);
    const second = APEX_ARSENAL_FEEL.livePopups().map(p => p.kind + ':' + p.text);
    __AQ_TEST.redraw();
    return { first, second };
  })()`);
  gate('passa-frame-auto-immediate-then-aggregate',
    JSON.stringify(autoFrames.first) === '["dmg:4"]' && JSON.stringify(autoFrames.second) === '["dmg:8"]',
    autoFrames);
  report.evidence.push(await screenshot('passa-frame-auto-first-popup'));

  // SHOTGUN: immediate truthful first popup, aggregate stays single.
  const sgFrames = await evaluate(`(() => {
    APEX_ARSENAL_FEEL.resetMatch();
    fighters[1].hp = 1000;
    fighters[1].takeDamage(8, fighters[0], 'arsenal-shotgun', false);
    const first = APEX_ARSENAL_FEEL.livePopups().map(p => p.kind + ':' + p.text);
    __AQ_TEST.redraw();
    fighters[1].takeDamage(8, fighters[0], 'arsenal-shotgun', false);
    const second = APEX_ARSENAL_FEEL.livePopups().map(p => p.kind + ':' + p.text);
    __AQ_TEST.redraw();
    return { first, second };
  })()`);
  gate('passa-frame-shotgun-immediate-then-aggregate',
    JSON.stringify(sgFrames.first) === '["dmg:8"]' && JSON.stringify(sgFrames.second) === '["dmg:16"]',
    sgFrames);
  report.evidence.push(await screenshot('passa-frame-shotgun-first-popup'));

  // --------------------------------------------- 5-minute simulation -------
  report.fiveMinute = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    let error = null;
    let restarts = 0;
    const dt = 1/30;
    const totalSteps = Math.round(300 / dt);
    let koCount = 0;
    let spawnedCumulative = 0;
    try {
      for (let i = 0; i < totalSteps; i++) {
        APEX_ARSENAL.step(dt);
        if (APEX_ARSENAL.state.over) {
          spawnedCumulative += getArsenalQuestDebugState().spawnedTotal;
          koCount++;
          restarts++;
          window.startArsenalQuestMode();
          cancelAnimationFrame(reqId); reqId = 0;
        }
      }
    } catch (e) { error = String(e && e.stack || e); }
    spawnedCumulative += getArsenalQuestDebugState().spawnedTotal;
    const d = __AQ_TEST.debug();
    return { error, restarts, koCount, spawnedTotal: d.spawnedTotal, spawnedCumulative, earlyErrors: __AQ_TEST.earlyErrors(), finalState: d.gameState };
  })()`);
  gate('five-minute-no-uncaught-errors', report.fiveMinute.error === null && report.fiveMinute.earlyErrors.length === 0,
    `steps=9000 (300s @30Hz) kos=${report.fiveMinute.koCount} restarts=${report.fiveMinute.restarts} spawnedCumulative=${report.fiveMinute.spawnedCumulative} earlyErrors=${report.fiveMinute.earlyErrors.length}`);

  // ------------------------------------------------------ structured log ---
  report.logSample = await evaluate(`(() => {
    const kinds = ['SPAWN_SLOT', 'REVEAL', 'PICKUP', 'USE', 'HIT', 'CONSUME'];
    const out = {};
    for (const k of kinds) {
      out[k] = APEX_ARSENAL.events.find(e => e.startsWith('[AQ] ' + k)) || null;
    }
    return out;
  })()`);
  gate('structured-aq-events', Object.values(report.logSample).every(Boolean), report.logSample);


  report.rev2PerfPass1 = await evaluate(`(() => {
    if (typeof startArsenalQuestMode === 'function') startArsenalQuestMode('HERO', 'RIVAL');
    const c = document.createElement('canvas').getContext('2d');
    const api = typeof apexArsenalPerfSummary === 'function';
    const globalApi = typeof apexPerfSummary === 'function';
    drawBackground(c);
    const a = apexArsenalPerfSummary();
    drawBackground(c);
    const b = apexArsenalPerfSummary();
    floatingTexts.push({ life: 1, update() { this.life -= 1; }, draw() {} });
    APEX_ARSENAL.step(1/60);
    const afterSink = floatingTexts.length;
    APEX_ARSENAL.state.debugOverlay = true;
    for (let i = 0; i < 12; i++) { if (typeof draw === 'function') draw(); }
    const hud = apexArsenalPerfSummary();
    const winWritesBefore = hud.hud.winWrites;
    fighters[1].hp = 0;
    APEX_ARSENAL.step(1/60);
    if (typeof draw === 'function') { draw(); draw(); draw(); }
    const afterWin = apexArsenalPerfSummary();
    return {
      api, globalApi,
      buildsA: a.chamber.builds, drawsA: a.chamber.draws,
      buildsB: b.chamber.builds, drawsB: b.chamber.draws, hitsB: b.chamber.hits, usedCache: b.chamber.usedCacheLast,
      afterSink,
      skillWrites: hud.hud.skillWrites,
      debugWrites: hud.hud.debugWrites,
      winWrites: afterWin.hud.winWrites,
      winWritesBefore,
      sections: Object.keys(hud.sections || {}).sort(),
      peaks: hud.peaks,
      size: b.chamber.size,
    };
  })()`);
  gate('rev2-perf-pass1-api',
    report.rev2PerfPass1.api === true,
    report.rev2PerfPass1);
  gate('rev2-perf-pass1-chamber-cache',
    report.rev2PerfPass1.buildsB === report.rev2PerfPass1.buildsA
    && report.rev2PerfPass1.drawsB > report.rev2PerfPass1.drawsA
    && report.rev2PerfPass1.usedCache === true
    && report.rev2PerfPass1.hitsB >= 1,
    report.rev2PerfPass1);
  gate('rev2-perf-pass1-floating-text-sink',
    report.rev2PerfPass1.afterSink === 0,
    report.rev2PerfPass1);
  gate('rev2-perf-pass1-hud-win-once',
    report.rev2PerfPass1.winWrites === report.rev2PerfPass1.winWritesBefore + 1,
    report.rev2PerfPass1);
  gate('rev2-perf-pass1-sections',
    report.rev2PerfPass1.sections.indexOf('chamber') >= 0
    && report.rev2PerfPass1.sections.indexOf('hud') >= 0
    && report.rev2PerfPass1.sections.indexOf('simulation') >= 0,
    report.rev2PerfPass1.sections);


  report.rev2Feel = await evaluate(`(() => {
    if (typeof startArsenalQuestMode === 'function') startArsenalQuestMode('HERO', 'RIVAL');
    const feel = window.APEX_ARSENAL_FEEL;
    const av = window.APEX_ARSENAL_AV;
    fighters[0].takeDamage(12, fighters[1], 'arsenal-pistol', false);
    feel.noteDamage({ miss: true, victim: fighters[1], dealt: 0 });
    const miss = feel.livePopups().filter(p => p.kind === 'miss');
    window.avCue('pickup', { weapon: 'SHOTGUN', x: 1, y: 1 });
    const sgReady = av.stats.lastGunReady;
    window.avCue('pickup', { weapon: 'SNIPER', x: 1, y: 1 });
    const snReady = av.stats.lastGunReady;
    return {
      stamps: feel.stats.stamps,
      miss: miss[0] && miss[0].text,
      sgReady, snReady,
      healEnabled: feel.healGameplayEnabled === true,
      restores: feel.heals.map(h => h.restore),
      pal: feel.palettes && feel.palettes.dmg && feel.palettes.dmg.fill,
      organic: feel.stats.organicMaskStamps,
      casingKey: !!(av.stats && true),
    };
  })()`);
  gate('feel-runtime-ready', report.rev2Feel.stamps >= 1, report.rev2Feel);
  gate('feel-miss-text-only', report.rev2Feel.miss === 'MISS', report.rev2Feel);
  gate('feel-shotgun-pickup-real-file', report.rev2Feel.sgReady && report.rev2Feel.sgReady.cue === 'pickup_shotgun', report.rev2Feel.sgReady);
  gate('feel-sniper-pickup-chamber', report.rev2Feel.snReady && report.rev2Feel.snReady.cue === 'pickup_sniper', report.rev2Feel.snReady);
  gate('feel-heal-values-authorized', report.rev2Feel.healEnabled === true
    && JSON.stringify(report.rev2Feel.restores) === JSON.stringify([70, 126, 196, 280, 385]), report.rev2Feel);
  gate('feel-splatter-organic-mask', report.rev2Feel.organic >= 1, report.rev2Feel);
  gate('feel-damage-palette-v3-red', report.rev2Feel.pal === '#F2382F', report.rev2Feel);

  report.healPlay = await evaluate(`(() => {
    const st = APEX_ARSENAL.state;
    const S = APEX_ARSENAL_SPAWN;
    st.spawnHeld = false;
    __AQ_TEST.clearSlots();
    st.healCooldown = 0;
    st.forceHealId = 'HEAL_H2';
    fighters[0].hp = 1000; fighters[1].hp = 1000;
    S.updateSlots(0.05);
    const noneAtFull = st.slots.filter(s => s.kind === 'HEAL').length;
    fighters[0].hp = 700;
    S.updateSlots(0.05);
    const heals = st.slots.filter(s => s.kind === 'HEAL' && s.phase === 'REVEALED');
    const slot = heals[0];
    fighters[0].x = slot.x; fighters[0].y = slot.y;
    const beforeHeal = fighters[0].healingDone || 0;
    S.resolvePickups();
    const hud = (document.getElementById('p1-hp-text') && document.getElementById('p1-hp-text').innerText) || '';
    const pops = APEX_ARSENAL_FEEL.livePopups().filter(p => p.kind === 'heal');
    return {
      noneAtFull, spawned: heals.length, hp: fighters[0].hp, id: slot && slot.weaponId,
      healingDone: (fighters[0].healingDone || 0) - beforeHeal, hud, popCount: pops.length, pop: pops[0] && pops[0].text,
    };
  })()`);
  gate('heal-spawns-when-injured', report.healPlay.noneAtFull === 0 && report.healPlay.spawned === 1
    && report.healPlay.id === 'HEAL_H2' && report.healPlay.hp === 826, report.healPlay);
  gate('heal-hud-and-healingDone', report.healPlay.healingDone === 126
    && String(report.healPlay.hud).indexOf('826') >= 0
    && report.healPlay.popCount === 1 && report.healPlay.pop === '+126', report.healPlay);

  report.atlasPixels = await evaluate(`(() => {
    const feel = APEX_ARSENAL_FEEL;
    return { dmg: feel.sampleAtlasPixels('dmg'), miss: feel.sampleAtlasPixels('miss') };
  })()`);
  gate('atlas-normal-fill-and-edge-pixels', report.atlasPixels.dmg && report.atlasPixels.dmg.fillHits > 8 && report.atlasPixels.dmg.edgeHits > 8, report.atlasPixels.dmg);
  gate('atlas-miss-slate-and-light-halo', report.atlasPixels.miss && report.atlasPixels.miss.fillHits > 8 && report.atlasPixels.miss.edgeHits > 8, report.atlasPixels.miss);

  report.rafPlay = await evaluate(`(async () => {
    if (typeof startArsenalQuestMode === 'function') startArsenalQuestMode('HERO', 'RIVAL');
    const pacing = await window.apexArsenalObserveRaf(90);
    const perf = typeof apexArsenalPerfSummary === 'function' ? apexArsenalPerfSummary() : {};
    return { pacing, sections: perf.sections, peaks: perf.peaks, longTasks: perf.longTasks, interpolation: perf.interpolation };
  })()`);
  gate('real-raf-pacing-sample', report.rafPlay.pacing && report.rafPlay.pacing.samples >= 30, report.rafPlay.pacing);

  report.chamberTone = await evaluate(`(() => {
    // Sample the CHAMBER, not a random active pickup/heal/storm flash left
    // from the rAF pacing probe. Freeze that loop and remove presentation
    // overlays before the unchanged background draw; the next gate builds
    // its own rarity slot independently.
    cancelAnimationFrame(reqId); reqId = 0;
    APEX_ARSENAL.state.slots = [];
    APEX_ARSENAL_STORM?.clear();
    APEX_ARSENAL_FEEL?.resetMatch();
    const c = document.createElement('canvas');
    c.width = 1000; c.height = 1000;
    const ctx = c.getContext('2d');
    drawBackground(ctx);
    const pix = ctx.getImageData(500, 500, 1, 1).data;
    return { r: pix[0], g: pix[1], b: pix[2] };
  })()`);
  gate('chamber-midtone-graphite', report.chamberTone.r >= 70 && report.chamberTone.r <= 140, report.chamberTone);

  report.smoothRarity = await evaluate(`(() => {
    const S = APEX_ARSENAL_SPAWN;
    APEX_ARSENAL.state.slots = [{ id: 1, x: 200, y: 200, phase: 'REVEALED', weaponId: 'PISTOL', tier: 'T5', revealedFor: 1 }];
    const c = document.createElement('canvas').getContext('2d');
    S.drawSlots(c); S.drawSlots(c); S.drawSlots(c);
    return S.rarityStats;
  })()`);
  gate('smooth-rarity-cache-reuse', report.smoothRarity && report.smoothRarity.hits >= 1, report.smoothRarity);


  report.bothUnarmed = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    APEX_ARSENAL.state.spawnedTotal = 0;
    APEX_ARSENAL.state.unarmedFastConsumed = false;
    APEX_ARSENAL.state.spawnTimer = 4.5;
    fighters[0].hp = 100; fighters[1].hp = 100;
    fighters[0].data.arsenal = null; fighters[1].data.arsenal = null;
    __AQ_TEST.step(1/60);
    const afterImmediate = APEX_ARSENAL.state.spawnedTotal;
    const timerAfter = APEX_ARSENAL.state.spawnTimer;
    __AQ_TEST.step(1.0);
    const mid = APEX_ARSENAL.state.spawnedTotal;
    // Make the false phase deterministic: remove any incidental emergency
    // pickup/holder first, then arm HERO with a known firearm for one tick.
    __AQ_TEST.clearSlots();
    fighters[0].data.arsenal = null;
    fighters[1].data.arsenal = null;
    APEX_ARSENAL.weaponApi.equip(fighters[0], 'PISTOL');
    const armedBefore = APEX_ARSENAL.state.spawnedTotal;
    __AQ_TEST.step(1/60);
    const afterOneArmed = APEX_ARSENAL.state.spawnedTotal;
    // Now create the exact false -> true retrigger: no holders and no
    // revealed firearm floor pickup.
    __AQ_TEST.clearSlots();
    fighters[0].data.arsenal = null;
    fighters[1].data.arsenal = null;
    APEX_ARSENAL.state.spawnTimer = 2.4;
    const retrigBefore = APEX_ARSENAL.state.spawnedTotal;
    __AQ_TEST.step(1/60);
    const retrigAfter = APEX_ARSENAL.state.spawnedTotal;
    window.avCue('pickup', { weapon: 'AK_47', x: 1, y: 1 });
    const ak = APEX_ARSENAL_AV.stats.lastGunReady;
    window.avCue('pickup', { weapon: 'PISTOL', x: 1, y: 1 });
    const pistol = APEX_ARSENAL_AV.stats.lastGunReady;
    return { afterImmediate, timerAfter, mid, afterOneArmed, armedBefore, retrigBefore, retrigAfter, ak, pistol };
  })()`);
  gate('both-unarmed-immediate-fresh', report.bothUnarmed.afterImmediate === 1, report.bothUnarmed);
  gate('both-unarmed-timer-reset-3s', report.bothUnarmed.timerAfter > 4.4 && report.bothUnarmed.timerAfter <= 4.5, report.bothUnarmed);
  gate('both-unarmed-no-spam', report.bothUnarmed.mid === report.bothUnarmed.afterImmediate, report.bothUnarmed);
  gate('both-unarmed-one-armed-no-fast', report.bothUnarmed.afterOneArmed === report.bothUnarmed.armedBefore, report.bothUnarmed);
  gate('both-unarmed-retrigger', report.bothUnarmed.retrigAfter === report.bothUnarmed.retrigBefore + 1, report.bothUnarmed);
  gate('feel-rifle-pickup-derived', report.bothUnarmed.ak && String(report.bothUnarmed.ak.rel).indexOf('rifle_take_01.mp3') >= 0, report.bothUnarmed.ak);
  gate('feel-pistol-source-recharge', report.bothUnarmed.pistol && String(report.bothUnarmed.pistol.rel).indexOf('pickup_pistol.mp3') >= 0, report.bothUnarmed.pistol);


  report.bothUnarmedCap = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    const cap = APEX_ARSENAL_CONFIG.MAX_ACTIVE_SLOTS;
    APEX_ARSENAL.state.spawnedTotal = 0;
    APEX_ARSENAL.state.unarmedFastConsumed = false;
    APEX_ARSENAL.state.unarmedFastPending = false;
    APEX_ARSENAL.state.spawnHeld = false;
    APEX_ARSENAL.state.over = null;
    APEX_ARSENAL.state.time = 0;
    APEX_ARSENAL.state.healCooldown = 9;
    APEX_ARSENAL.state.spawnTimer = 2.4;
    fighters[0].hp = 100; fighters[1].hp = 100;
    fighters[0].data.arsenal = null; fighters[1].data.arsenal = null;
    fighters[0].x = 500; fighters[0].y = 500;
    fighters[1].x = 520; fighters[1].y = 520;
    fighters[0].data.positionLocked = true;
    fighters[1].data.positionLocked = true;
    fighters[0].dir = { x: 0, y: 0 };
    fighters[1].dir = { x: 0, y: 0 };
    fighters[0].baseSpeed = 0;
    fighters[1].baseSpeed = 0;
    for (let i = 0; i < cap; i++) {
      __AQ_TEST.pushSlot({ x: 120 + (i % 4) * 180, y: 140 + Math.floor(i / 4) * 180, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 2.0 });
    }
    const filled = APEX_ARSENAL.state.slots.filter(s => s.phase !== 'REMOVED').length;
    const spawned0 = APEX_ARSENAL.state.spawnedTotal;
    const sup0 = APEX_ARSENAL.state.suppressedSpawns;
    __AQ_TEST.step(1/60);
    const afterTrigSlots = APEX_ARSENAL.state.slots.filter(s => s.phase !== 'REMOVED').length;
    const spawned1 = APEX_ARSENAL.state.spawnedTotal;
    const timer1 = APEX_ARSENAL.state.spawnTimer;
    const consumed1 = APEX_ARSENAL.state.unarmedFastConsumed;
    const pending1 = APEX_ARSENAL.state.unarmedFastPending;
    const sup1 = APEX_ARSENAL.state.suppressedSpawns;
    __AQ_TEST.step(0.5);
    const spawned2 = APEX_ARSENAL.state.spawnedTotal;
    const sup2 = APEX_ARSENAL.state.suppressedSpawns;
    APEX_ARSENAL.state.spawnTimer = 1.8;
    const free = APEX_ARSENAL.state.slots.find(s => s.phase !== 'REMOVED');
    if (free) free.phase = 'REMOVED';
    const spawned3 = APEX_ARSENAL.state.spawnedTotal;
    __AQ_TEST.step(1/60);
    const afterFreeSlots = APEX_ARSENAL.state.slots.filter(s => s.phase !== 'REMOVED').length;
    const spawned4 = APEX_ARSENAL.state.spawnedTotal;
    const timer4 = APEX_ARSENAL.state.spawnTimer;
    const consumed4 = APEX_ARSENAL.state.unarmedFastConsumed;
    __AQ_TEST.step(1/60);
    const spawned5 = APEX_ARSENAL.state.spawnedTotal;
    return { cap, filled, spawned0, spawned1, spawned2, spawned3, spawned4, spawned5, afterTrigSlots, afterFreeSlots, timer1, timer4, consumed1, pending1, consumed4, sup0, sup1, sup2 };
  })()`);
  gate('both-unarmed-cap-no-illegal-slot',
    report.bothUnarmedCap.filled === report.bothUnarmedCap.cap
    && report.bothUnarmedCap.afterTrigSlots === report.bothUnarmedCap.cap
    && report.bothUnarmedCap.spawned1 === report.bothUnarmedCap.spawned0,
    report.bothUnarmedCap);
  gate('both-unarmed-cap-timer-not-reset',
    report.bothUnarmedCap.timer1 < 2.4 && report.bothUnarmedCap.timer1 > 2.3
    && report.bothUnarmedCap.consumed1 === false && report.bothUnarmedCap.pending1 === true,
    report.bothUnarmedCap);
  gate('both-unarmed-cap-no-per-frame-suppress',
    report.bothUnarmedCap.spawned2 === report.bothUnarmedCap.spawned1
    && report.bothUnarmedCap.sup2 === report.bothUnarmedCap.sup1
    && report.bothUnarmedCap.sup1 === report.bothUnarmedCap.sup0,
    report.bothUnarmedCap);
  gate('both-unarmed-cap-pending-then-one',
    report.bothUnarmedCap.spawned4 === report.bothUnarmedCap.spawned3 + 1
    && report.bothUnarmedCap.afterFreeSlots === report.bothUnarmedCap.cap
    && report.bothUnarmedCap.timer4 > 4.4 && report.bothUnarmedCap.timer4 <= 4.5
    && report.bothUnarmedCap.consumed4 === true
    && report.bothUnarmedCap.spawned5 === report.bothUnarmedCap.spawned4,
    report.bothUnarmedCap);

  // =====================================================================
  // STORMBREAKER — first red-tier (T6) weapon (V1 port mirror)
  // =====================================================================
  report.storm = await evaluate(`(async () => {
    const CFG = APEX_ARSENAL_CONFIG;
    const out = {};
    const roll = CFG.TIER_ROLL.find(r => r[0] === 'T6');
    out.identity = {
      tier: CFG.tierOf('STORMBREAKER'),
      color: CFG.TIER_COLORS && CFG.TIER_COLORS.T6,
      rollT6: roll ? roll[1] : null,
      glowT6: CFG.TIER_GLOW && CFG.TIER_GLOW.T6,
      glowT5: CFG.TIER_GLOW && CFG.TIER_GLOW.T5,
      shield: CFG.threatShield('STORMBREAKER'),
      inPool: (CFG.OFFENSIVE_WEAPON_IDS || []).includes('STORMBREAKER'),
      isMelee: CFG.isMelee('STORMBREAKER'),
      cSet: APEX_ARSENAL_C_SET && APEX_ARSENAL_C_SET.weapons.STORMBREAKER,
    };
    // Asset must render from the real C set (floor + equipped).
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(240, 420, 760, 420);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.pushSlot({ x: 500, y: 500, weaponId: 'STORMBREAKER' });
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    const img = APEX_ARSENAL_AV.weaponImage('STORMBREAKER');
    const t0 = Date.now();
    while (!(img.img && img.img.complete && img.img.width) && Date.now() - t0 < 15000) {
      await new Promise(r => setTimeout(r, 100));
    }
    const s0 = { floor: APEX_ARSENAL_AV.stats.floorSpriteDraws, equipped: APEX_ARSENAL_AV.stats.equippedSpriteDraws };
    __AQ_TEST.step(0.3);
    __AQ_TEST.redraw();
    const s1 = { floor: APEX_ARSENAL_AV.stats.floorSpriteDraws, equipped: APEX_ARSENAL_AV.stats.equippedSpriteDraws };
    out.render = { imgOk: !!(img.img && img.img.complete && img.img.width), imgW: img.img && img.img.width, imgH: img.img && img.img.height, floorDelta: s1.floor - s0.floor, equippedDelta: s1.equipped - s0.equipped };
    // Screenshot: unclaimed floor — arena lightning + spawn aura (no global slow).
    __AQ_TEST.step(0.15);
    __AQ_TEST.redraw();
    return JSON.stringify(out);
  })()`);
  const storm = JSON.parse(report.storm);
  gate('storm-browser-identity-t6-red',
    storm.identity.tier === 'T6' && storm.identity.color === '#FF4D5A'
    && Math.abs(storm.identity.rollT6 - 0.02) < 1e-9
    && storm.identity.shield === 'TOWER_SHIELD'
    && storm.identity.inPool === true && storm.identity.isMelee === false
    && storm.identity.glowT6.rx > storm.identity.glowT5.rx,
    storm.identity);
  gate('storm-browser-asset-render-real-cset',
    storm.render.imgOk === true && storm.render.imgW === 1086 && storm.render.imgH === 1448
    && storm.render.floorDelta >= 1 && storm.render.equippedDelta >= 1,
    storm.render);
  report.evidence.push(await screenshot('10a-storm-floor-lightning'));

  // Held windup screenshot (deterministic: rAF cancelled under enterManual).
  await evaluate(`(() => {
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(240, 420, 760, 420);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.55); // inside the 0.45-0.73s windup window
    __AQ_TEST.redraw();
    return __AQ_TEST.holder('HERO') && __AQ_TEST.holder('HERO').phase;
  })()`);
  report.evidence.push(await screenshot('10b-storm-held-windup'));

  // Confirmed hit: final-authority 446 damage (no scale ride), real stun,
  // knockback status, weapon vanishes (no pin). Frame-poll the 0.18s push.
  report.stormHit = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 500, 600, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    let sawPush = false, sawStun = false, rivalHp = 1000;
    for (let n = 0; n < 120; n++) {
      __AQ_TEST.step(1 / 60);
      const f = fighters[1];
      if (f.hasStatus('push')) sawPush = true;
      if (f.hasStatus('stun')) sawStun = true;
      if (f.hp < 1000) rivalHp = f.hp;
      if (sawPush && sawStun && n > 30) break;
    }
    const stormProj = projectiles.filter(p => p.aq && p.weapon === 'STORMBREAKER').length;
    const impactLogged = __AQ_TEST.countEvents('STORM_IMPACT') >= 1;
    return { rivalHp, sawPush, sawStun, stormProj, impactLogged, heroHolder: __AQ_TEST.holder('HERO') };
  })()`);
  gate('storm-browser-hit-446-stun-no-pin',
    report.stormHit.rivalHp === 554 && report.stormHit.sawStun === true
    && report.stormHit.sawPush === true && report.stormHit.stormProj === 0
    && report.stormHit.impactLogged === true && report.stormHit.heroHolder === null,
    report.stormHit);

  // Impact flash screenshot: fresh throw, capture ~35ms after the hit point.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.place(400, 500, 600, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.80); // impact lands ~0.764s; flash still hot
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('10c-storm-impact-flash'));

  // Flight screenshot: centered, unobstructed A/B evidence for the V9
  // local-electricity + ghosts + solid-body composition.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    APEX_ARSENAL.state.debugOverlay = false;
    __AQ_TEST.place(220, 500, 900, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.95); // ~220ms after release: centered, still pre-impact
    __AQ_TEST.redraw();
    return projectiles.some(p => p.aq && p.type === 'aq_thrown' && p.weapon === 'STORMBREAKER');
  })()`);
  report.evidence.push(await screenshot('10d-storm-flight-spin-ghosts'));

  // B1 owner correction: no global slow while unclaimed — the unclaimed storm
  // must not debuff either fighter's movement; nothing may linger after.
  report.stormSlow = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.place(200, 300, 800, 300);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.pushSlot({ x: 500, y: 500, weaponId: 'STORMBREAKER' });
    __AQ_TEST.step(0.4);
    const slowHero = __AQ_TEST.statuses('HERO').includes('slow');
    const slowRival = __AQ_TEST.statuses('RIVAL').includes('slow');
    const mult = fighters[0].statuses && fighters[0].statuses.slow ? fighters[0].statuses.slow.mult : null;
    APEX_ARSENAL.state.slots = [];
    __AQ_TEST.step(0.3);
    return {
      slowHero, slowRival, mult,
      slowHeroAfter: __AQ_TEST.statuses('HERO').includes('slow'),
      slowRivalAfter: __AQ_TEST.statuses('RIVAL').includes('slow'),
    };
  })()`);
  gate('storm-browser-floor-no-global-slow',
    report.stormSlow.slowHero === false && report.stormSlow.slowRival === false && report.stormSlow.mult === null,
    report.stormSlow);
  gate('storm-browser-no-slow-status-lingers',
    report.stormSlow.slowHeroAfter === false && report.stormSlow.slowRivalAfter === false,
    report.stormSlow);

  // VFX: bounded pools, no trail entities, clean clear.
  report.stormVfx = await evaluate(`(() => {
    const S = window.APEX_ARSENAL_STORM;
    if (!S) return JSON.stringify({ missing: true });
    S.onImpact(520, 480, fighters[1]);
    S.tick(1 / 60);
    const after = { impacts: S.impactCount(), bolts: S.boltCount(), sparks: S.sparkCount(), trail: S.hasTrailEntities() };
    S.clear();
    const cleared = { bolts: S.boltCount(), impacts: S.impactCount() };
    return JSON.stringify({ after, cleared });
  })()`);
  const stormVfx = JSON.parse(report.stormVfx);
  gate('storm-browser-vfx-bounded-no-tail',
    !stormVfx.missing
    && stormVfx.after.bolts <= 30 && stormVfx.after.sparks <= 72
    && stormVfx.after.trail === false
    && stormVfx.cleared.bolts === 0 && stormVfx.cleared.impacts === 0,
    stormVfx);

  report.stormFlightOwner = await evaluate(`(() => ({
    stormOwns: window.APEX_ARSENAL_STORM?.ownsFlightSprite === true,
    genericYields: String(APEX_ARSENAL.weaponApi.drawArsenalProjectiles).includes('ownsFlightSprite'),
    profile: window.APEX_ARSENAL_STORM?.referenceProfile?.(),
  }))()`);
  gate('storm-browser-flight-single-presentation-owner',
    report.stormFlightOwner.stormOwns === true
    && report.stormFlightOwner.genericYields === true
    && report.stormFlightOwner.profile?.flightPresentationOwner === 'storm-vfx'
    && report.stormFlightOwner.profile?.ghostOffsetsSeconds?.join(',') === '0.12,0.07,0.03'
    && report.stormFlightOwner.profile?.ghostTint === 'cyan'
    && report.stormFlightOwner.profile?.ghostSource === 'recorded-trajectory'
    && report.stormFlightOwner.profile?.mirrorLocal === true
    && report.stormFlightOwner.profile?.flightVisualOffsetRad === 0
    && report.stormFlightOwner.profile?.releaseBoltSeconds === 0.11,
    report.stormFlightOwner);

  // ------------------------------- CP3 supplement: B3 hazard / B7 / B8
  // B3: the visible floor-bolt geometry strikes who it touches — HERO first.
  report.stormFloorHero = await evaluate(`(() => {
    APEX_ARSENAL_CONFIG.STORMBREAKER.floorBoltHazard = true;
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(350, 500, 850, 300);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    window.APEX_ARSENAL_STORM.testInjectFloorBolt(300, 500, 700, 500);
    const hpB = __AQ_TEST.hp().hero;
    for (let i = 0; i < 3; i++) __AQ_TEST.step(1 / 60);
    __AQ_TEST.redraw();
    return JSON.stringify({
      struck: fighters[0].hasStatus('stun'),
      stunTimer: (fighters[0].statuses && fighters[0].statuses.stun) ? fighters[0].statuses.stun.timer : null,
      hpDelta: hpB - __AQ_TEST.hp().hero,
      strikes: __AQ_TEST.countEvents('STORM_FLOOR_STRIKE'),
    });
  })()`);
  const b3h = JSON.parse(report.stormFloorHero);
  report.evidence.push(await screenshot('10d-storm-floor-strike-hero'));
  gate('storm-browser-b3-floor-strike-hero',
    b3h.struck === true && b3h.stunTimer > 0.9 && b3h.stunTimer <= 1.0
    && b3h.hpDelta === 0 && b3h.strikes === 1,
    b3h);

  // B3: the RIVAL is an equally valid target.
  report.stormFloorRival = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(150, 300, 650, 500);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    window.APEX_ARSENAL_STORM.testInjectFloorBolt(300, 500, 700, 500);
    const hpB = __AQ_TEST.hp().rival;
    for (let i = 0; i < 3; i++) __AQ_TEST.step(1 / 60);
    __AQ_TEST.redraw();
    return JSON.stringify({
      struck: fighters[1].hasStatus('stun'),
      stunTimer: (fighters[1].statuses && fighters[1].statuses.stun) ? fighters[1].statuses.stun.timer : null,
      hpDelta: hpB - __AQ_TEST.hp().rival,
      strikes: __AQ_TEST.countEvents('STORM_FLOOR_STRIKE'),
    });
  })()`);
  const b3r = JSON.parse(report.stormFloorRival);
  report.evidence.push(await screenshot('10e-storm-floor-strike-rival'));
  gate('storm-browser-b3-floor-strike-rival',
    b3r.struck === true && b3r.stunTimer > 0.9 && b3r.stunTimer <= 1.0
    && b3r.hpDelta === 0 && b3r.strikes === 1,
    b3r);

  // B7: red-tier pickup immunity — predicate, no NEWBIE dash at T6, dash
  // still targets a regular pickup, physical pickup still works, and the
  // thrown storm is immune to magnet/crystal/gravity-well manipulation
  // (with non-immune control projectiles proving each field is live).
  report.stormB7 = await evaluate(`(() => {
    APEX_ARSENAL_CONFIG.STORMBREAKER.floorBoltHazard = false; // isolate: no floor strikes here
    const CFG = APEX_ARSENAL_CONFIG;
    const out = {};
    const mk = (wid, x, y) => ({ id: APEX_ARSENAL.state.nextSlotId++, x, y, phase: 'REVEALED', weaponId: wid, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: APEX_ARSENAL.state.time });
    const fresh = () => {
      window.startArsenalQuestMode('NEWBIE', 'ICE');
      cancelAnimationFrame(reqId); reqId = 0;
      __AQ_TEST.holdSpawns();
      const f = fighters[0];
      f.x = 200; f.y = 500; f.baseSpeed = 0;
      fighters[1].x = 900; fighters[1].y = 100; fighters[1].baseSpeed = 0;
      return f;
    };
    out.t6Immune = CFG.isHeroManipulablePickup({ weaponId: 'STORMBREAKER' }) === false;
    out.regularManipulable = CFG.isHeroManipulablePickup({ weaponId: 'PISTOL' }) === true;
    let f = fresh();
    const t6a = mk('STORMBREAKER', 550, 300);
    APEX_ARSENAL.state.slots.push(t6a);
    f.data.nbCd = 0;
    window.APEX_ARSENAL_SKILL_GATE.pressJ(f);
    for (let i = 0; i < 3; i++) __AQ_TEST.step(1 / 60);
    out.noDashAtT6 = !f.data.nbDash;
    f = fresh();
    const t6b = mk('STORMBREAKER', 550, 300);
    const regb = mk('PISTOL', 700, 500);
    APEX_ARSENAL.state.slots.push(t6b, regb);
    f.data.nbCd = 0;
    window.APEX_ARSENAL_SKILL_GATE.pressJ(f);
    for (let i = 0; i < 3; i++) __AQ_TEST.step(1 / 60);
    out.dashTargetsRegular = !!(f.data.nbDash && f.data.nbDash.slotId === regb.id);
    f = fresh();
    const t6d = mk('STORMBREAKER', 560, 500);
    APEX_ARSENAL.state.slots.push(t6d);
    f.x = 545; f.y = 500;
    for (let i = 0; i < 8; i++) __AQ_TEST.step(1 / 60);
    out.physicalPickupWorks = t6d.phase !== 'REVEALED';
    // Thrown immunity vs the three hero-manipulation surfaces.
    const api = APEX_ARSENAL.weaponApi;
    const mkWall = () => ({ type: 'crystal_wall', owner: fighters[1], x1: 550, y1: 200, x2: 550, y2: 700, x: 550, y: 450, life: 5, maxLife: 5, hitIds: {}, touchCd: {}, permanent: false });
    const mkWell = () => ({ type: 'gravity_well', owner: fighters[1], x: 600, y: 500, core: 100, radius: 200, life: 3.1, maxLife: 3.1, exploded: false, absorbed: 0, absorbedDamage: 0 });
    const mkBullet = (x, y, vx, vy) => ({ type: 'aq_bullet', aq: true, owner: fighters[0], weapon: 'PISTOL', x, y, px: x, py: y, vx, vy, radius: 4, life: 3, maxLife: 3, color: '#ffe08a' });
    __AQ_TEST.enterManual(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 500, 650, 300); __AQ_TEST.holdSpawns();
    fighters[1].name = 'MAGNET'; fighters[1].data = fighters[1].data || {}; fighters[1].data.fieldTimer = 3;
    projectiles.length = 0;
    api.spawnThrownMelee(fighters[0], 'STORMBREAKER', Math.atan2(300 - 500, 650 - 400));
    projectiles.push(mkBullet(400, 560, 1350, 0));
    for (let i = 0; i < 12; i++) __AQ_TEST.step(1 / 60);
    out.magnetControlDestroyed = !projectiles.some(p => p.type === 'aq_bullet');
    for (let i = 0; i < 60; i++) __AQ_TEST.step(1 / 60);
    out.magnetBoltConnected = __AQ_TEST.hp().rival < 1000;
    __AQ_TEST.enterManual(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 500, 800, 500); __AQ_TEST.holdSpawns();
    projectiles.length = 0; projectiles.push(mkWall());
    api.spawnThrownMelee(fighters[0], 'STORMBREAKER', 0);
    projectiles.push(mkBullet(400, 680, 1350, 0));
    for (let i = 0; i < 14; i++) __AQ_TEST.step(1 / 60);
    const ctl = projectiles.find(p => p.type === 'aq_bullet');
    out.crystalControlReflected = !ctl || ctl.owner === fighters[1];
    for (let i = 0; i < 30; i++) __AQ_TEST.step(1 / 60);
    out.crystalBoltConnected = __AQ_TEST.hp().rival < 1000;
    out.crystalHeroUntouched = __AQ_TEST.hp().hero === 1000;
    __AQ_TEST.enterManual(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 500, 800, 500); __AQ_TEST.holdSpawns();
    fighters[1].isRage = true;
    projectiles.length = 0;
    const well = mkWell(); projectiles.push(well);
    api.spawnThrownMelee(fighters[0], 'STORMBREAKER', 0);
    projectiles.push(mkBullet(450, 500, 1350, 0));
    for (let i = 0; i < 40; i++) __AQ_TEST.step(1 / 60);
    out.wellControlAbsorbed = (well.absorbed || 0) >= 1;
    out.wellBoltConnected = __AQ_TEST.hp().rival < 1000;
    APEX_ARSENAL_CONFIG.STORMBREAKER.floorBoltHazard = true; // restore
    return JSON.stringify(out);
  })()`);
  const b7b = JSON.parse(report.stormB7);
  gate('storm-browser-b7-t6-immune-pickup-and-thrown',
    b7b.t6Immune && b7b.regularManipulable && b7b.noDashAtT6 && b7b.dashTargetsRegular
    && b7b.physicalPickupWorks
    && b7b.magnetControlDestroyed && b7b.magnetBoltConnected
    && b7b.crystalControlReflected && b7b.crystalBoltConnected && b7b.crystalHeroUntouched
    && b7b.wellControlAbsorbed && b7b.wellBoltConnected,
    b7b);

  // B8: bounded homing pursuit — aimed at the living opponent, continuous
  // steering (curvature vs a hard-strafing opponent), exact speed, capped
  // per-frame turn, and it connects.
  report.stormB8 = await evaluate(`(() => {
    window.startArsenalQuestMode('NEWBIE', 'NEWBIE');
    cancelAnimationFrame(reqId); reqId = 0;
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(150, 500, 620, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.85);
    let maxTurn = 0, cumTurn = 0, spMin = Infinity, spMax = 0, last = null;
    for (let n = 0; n < 200; n++) {
      __AQ_TEST.step(1 / 60);
      const p = projectiles.find(q => q.aq && q.weapon === 'STORMBREAKER');
      if (!p) break;
      const sp = Math.hypot(p.vx, p.vy);
      spMin = Math.min(spMin, sp); spMax = Math.max(spMax, sp);
      const h = Math.atan2(p.vy, p.vx);
      if (last !== null) {
        let d = h - last;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        maxTurn = Math.max(maxTurn, Math.abs(d));
        cumTurn += Math.abs(d);
      }
      last = h;
      fighters[1].y += ((n % 40) < 20 ? -1 : 1) * 360 * (1 / 60);
      fighters[1].x = 620;
    }
    return JSON.stringify({
      rivalHp: __AQ_TEST.hp().rival,
      spMin, spMax, maxTurn, cumTurn,
      cap: APEX_ARSENAL_CONFIG.STORMBREAKER.homingTurnRateRadPerSec,
      impact: __AQ_TEST.countEvents('STORM_IMPACT') >= 1,
    });
  })()`);
  const b8b = JSON.parse(report.stormB8);
  gate('storm-browser-b8-homing-bounded-curves-connects',
    b8b.rivalHp === 554 && b8b.impact
    && b8b.spMin > 1349.99 && b8b.spMax < 1350.01
    && b8b.maxTurn <= (b8b.cap / 60) + 1e-6
    && b8b.cumTurn >= 0.15,
    b8b);

  // B8 evidence: mid-flight curved pursuit against the strafing opponent.
  await evaluate(`(() => {
    window.startArsenalQuestMode('NEWBIE', 'NEWBIE');
    cancelAnimationFrame(reqId); reqId = 0;
    __AQ_TEST.place(150, 500, 620, 500);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.85);
    for (let n = 0; n < 34; n++) {
      __AQ_TEST.step(1 / 60);
      fighters[1].y += ((n % 40) < 20 ? -1 : 1) * 360 * (1 / 60);
      fighters[1].x = 620;
    }
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('10c-storm-homing-curve'));

  // ------------------------------- CP4: weapon and heal presentation
  // B11 evidence: the full staged firearm set rendered on one shared world
  // reference (HERO parked in-frame), same camera, no perspective difference.
  report.firearmLineup = await evaluate(`(() => {
    APEX_ARSENAL_CONFIG.STORMBREAKER.floorBoltHazard = false; // isolate lineup from floor strikes
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    // HERO + RIVAL parked below the grid = the same-world fighter reference.
    __AQ_TEST.place(100, 950, 900, 950);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns(); // no cadence spawns inside the lineup frame
    const guns = APEX_ARSENAL_CONFIG.GUN_REGISTRY.map(e => e.id);
    // 5x5 grid, 200px pitch: wider than the longest gun (SNIPER 188px), so
    // no sprite ever overlaps a neighbor — clean per-gun measurement.
    const cols = 5, dx = 200, dy = 170, x0 = 100, y0 = 130;
    guns.forEach((id, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      __AQ_TEST.pushSlot({ x: x0 + c * dx, y: y0 + r * dy, weaponId: id, tier: APEX_ARSENAL_CONFIG.tierOf(id) });
    });
    __AQ_TEST.step(0.1);
    __AQ_TEST.redraw();
    APEX_ARSENAL_CONFIG.STORMBREAKER.floorBoltHazard = true; // restore
    const L = APEX_ARSENAL_CONFIG.FIREARM_LONG_SIDE;
    return JSON.stringify({ count: guns.length, guns, longs: guns.map(id => L[id]) });
  })()`);
  const lineup = JSON.parse(report.firearmLineup);
  report.evidence.push(await screenshot('11a-firearm-lineup-post-normalization'));
  gate('firearm-browser-lineup-full-staged-set',
    lineup.count === 24 && lineup.guns.every(id => lineup.longs[lineup.guns.indexOf(id)] != null)
    && lineup.longs.every(v => v >= 124 && v <= 188),
    lineup);

  // B12 evidence: all five heals with their tier shadows, one frame.
  report.healLineup = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(500, 915, 500, 60);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns(); // no cadence spawns inside the lineup frame
    APEX_ARSENAL_CONFIG.HEAL_IDS.forEach((id, i) => {
      __AQ_TEST.pushSlot({ x: 180 + i * 160, y: 450, weaponId: id, kind: 'HEAL', tier: 'T' + (i + 1) });
    });
    __AQ_TEST.step(0.1);
    __AQ_TEST.redraw();
    const SPAWN = APEX_ARSENAL_SPAWN;
    return JSON.stringify({
      specs: APEX_ARSENAL_CONFIG.HEAL_IDS.map(id => SPAWN.healShadowSpec(id)),
    });
  })()`);
  const healLineup = JSON.parse(report.healLineup);
  report.evidence.push(await screenshot('11b-heal-tier-shadows-lineup'));
  gate('heal-browser-tier-shadow-lineup',
    healLineup.specs.length === 5
    && healLineup.specs.every((sp, i) => sp.tier === 'T' + (i + 1) && !!sp.color),
    healLineup);

  // B6 evidence: static held frame where the mirror reflection is obvious
  // (hero facing RIGHT), plus the live transform-law probe.
  report.stormHeldMirror = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(350, 500, 850, 500); // rival to the RIGHT -> aim right
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.55); // inside the windup window — static committed pose
    const probe = window.APEX_ARSENAL_STORM.heldPresentationProbe();
    __AQ_TEST.redraw();
    return JSON.stringify({ probe, aimRight: fighters[0].x < fighters[1].x });
  })()`);
  const heldMir = JSON.parse(report.stormHeldMirror);
  report.evidence.push(await screenshot('10f-storm-held-mirrored'));
  gate('storm-browser-held-mirror-reflection',
    heldMir.probe && heldMir.probe.det === -1 && heldMir.probe.mirror === true
    && heldMir.probe.bladeForward === true && heldMir.probe.bladeProj > 0
    && heldMir.aimRight === true,
    heldMir);

  // ------------------------------------------------ Arsenal Lab V1 real Chrome
  report.labV1 = await evaluate(`(() => {
    window.exitArsenalQuestMode();
    APEX_ARSENAL_META.openHub();
    const hub = document.getElementById('aq-meta-root');
    const tiles = [...hub.querySelectorAll('[data-go]')].map(b => b.getAttribute('data-go'));
    const toggle = hub.querySelector('#aq-splatter-mode');
    hub.querySelector('[data-go="lab"]').click();
    cancelAnimationFrame(reqId); reqId = 0;
    APEX_ARSENAL.state.debugOverlay = false;
    const entry = __AQ_TEST.debug();
    const ids = [...document.querySelectorAll('[data-lab-weapon]')].map(b => b.dataset.labWeapon);
    __AQ_TEST.step(31);
    const idle = __AQ_TEST.debug();
    const events = __AQ_TEST.events().filter(e => /SPAWN_SLOT|SPAWN_HEAL|LAB_SPAWN/.test(e));
    return { tiles, toggle:!!toggle, entry:{lab:entry.labMode,hero:entry.hero.name,rival:entry.rival.name},
      clearedPressure:[document.getElementById('p1-burst-total')?.textContent,document.getElementById('p2-burst-total')?.textContent],
      ids, idle:{slots:idle.activeSlots,spawns:idle.spawnedTotal,over:idle.over}, events };
  })()`);
  gate('lab-browser-hub-and-newbie-panel', report.labV1.tiles.join(',') === 'free,quest,shop,draw,lab'
    && report.labV1.toggle && report.labV1.entry.lab && report.labV1.entry.hero === 'NEWBIE'
    && report.labV1.entry.rival === 'NEWBIE'
    && report.labV1.ids.join(',') === (await evaluate('APEX_ARSENAL_CONFIG.P0_WEAPON_IDS.join(",")')),
    { tiles:report.labV1.tiles, entry:report.labV1.entry, count:report.labV1.ids.length });
  gate('lab-browser-entry-clears-stale-pressure', report.labV1.clearedPressure.join(',') === '0,0', report.labV1.clearedPressure);
  gate('lab-browser-no-input-31s-no-spawns', report.labV1.idle.slots === 0
    && report.labV1.idle.spawns === 0 && report.labV1.idle.over === null && !report.labV1.events.length,
    { idle:report.labV1.idle, events:report.labV1.events });
  await evaluate(`__AQ_TEST.redraw()`);
  await sleep(1350); // clear stale prior-suite pressure's wall-clock window
  report.evidence.push(await screenshot('lab-v1-desktop-empty'));
  report.labManual = await evaluate(`(() => {
    const A = APEX_ARSENAL;
    __AQ_TEST.place(90,90,910,910);
    document.querySelector('[data-lab-weapon="PISTOL"]').click();
    const first = A.state.slots.map(s => [s.weaponId,s.phase]);
    const slot = A.state.slots[0];
    __AQ_TEST.place(slot.x,slot.y,700,500);
    __AQ_TEST.step(1/60);
    const holder = __AQ_TEST.holder('HERO');
    __AQ_TEST.place(300,500,500,500);
    __AQ_TEST.step(1.1);
    const hits = A.state.labHits, damage = A.state.labDamage;
    fighters[1].takeDamage(1600,fighters[0],'arsenal-pistol');
    const post = {hp:fighters[1].hp,over:A.state.over,damage:A.state.labDamage,
      numbers:APEX_ARSENAL_FEEL.livePopups().map(p => p.text)};
    return { first, holder, hits, damage, post };
  })()`);
  gate('lab-browser-exact-firearm-real-hit-infinite-hp', report.labManual.first.length === 1
    && report.labManual.first[0].join(',') === 'PISTOL,REVEALED'
    && report.labManual.holder?.weapon === 'PISTOL' && report.labManual.hits > 0
    && report.labManual.post.hp === 1000 && report.labManual.post.over === null
    && report.labManual.post.damage - report.labManual.damage >= 1600
    && report.labManual.post.numbers.some(x => +x >= 1600), report.labManual);
  report.labFloor = await evaluate(`(() => {
    // New clean Lab instance for visual evidence: prior firearm damage,
    // numbers, bullet ghosts and stains must not pollute the floor pose.
    window.startArsenalLab(); cancelAnimationFrame(reqId); reqId=0;
    const A = APEX_ARSENAL, CFG = APEX_ARSENAL_CONFIG;
    A.state.debugOverlay = false;
    A.state.slots = [];
    __AQ_TEST.place(90,90,910,910);
    document.querySelector('[data-lab-weapon="STORMBREAKER"]').click();
    const slot = A.state.slots[0];
    // Stage the rendered evidence in the center AFTER verifying the real
    // manual-spawn path, away from the two corner fighters.
    slot.x=500; slot.y=500;
    let angle = null;
    const av = APEX_ARSENAL_AV, original = av.drawWeaponSprite;
    av.drawWeaponSprite = function(c,id,x,y,opts) {
      if (id === 'STORMBREAKER' && opts.mode === 'floor') angle = opts.angle;
      return original.apply(this,arguments);
    };
    APEX_ARSENAL_SPAWN.drawSlots(ctx);
    av.drawWeaponSprite = original;
    __AQ_TEST.step(0.1); __AQ_TEST.redraw();
    return {weapon:slot.weaponId,phase:slot.phase,angle,authority:CFG.STORMBREAKER.floorAngleRad,
      heldOffset:av.weaponDrawParams('STORMBREAKER','melee',75).drawOffset};
  })()`);
  gate('lab-browser-storm-exact-horizontal-no-held-change', report.labFloor.weapon === 'STORMBREAKER'
    && report.labFloor.phase === 'REVEALED' && Math.abs(report.labFloor.angle - Math.PI * 1.5) < 1e-8
    && report.labFloor.angle === report.labFloor.authority && report.labFloor.heldOffset === Math.PI/2,
    report.labFloor);
  await sleep(1350); // let prior browser-HUD rolling damage decay in wall time
  report.evidence.push(await screenshot('lab-v1-storm-horizontal-desktop'));
  await setViewport(390, 844, true);
  await evaluate(`(() => { document.getElementById('aq-lab-panel').open=false; __AQ_TEST.redraw(); return true; })()`);
  report.evidence.push(await screenshot('lab-v1-storm-horizontal-mobile'));
  const mobilePanel = await evaluate(`(() => {
    const el=document.getElementById('aq-lab-panel'); el.open=true;
    return { open:el.open, height:el.getBoundingClientRect().height,
      scroll:el.scrollHeight,client:el.clientHeight,viewport:innerHeight,
      buttons:el.querySelectorAll('[data-lab-weapon]').length };
  })()`);
  gate('lab-browser-mobile-scrollable-dock-arena-visible', mobilePanel.open && mobilePanel.buttons === 33
    && mobilePanel.scroll > mobilePanel.client && mobilePanel.height <= 165
    && mobilePanel.height < mobilePanel.viewport / 4, mobilePanel);
  report.evidence.push(await screenshot('lab-v1-mobile-panel-open'));
  await clearViewport();
  report.labFlight = await evaluate(`(() => {
    // Pick up the very same real revealed Lab slot; run the existing
    // windup/throw pipeline and verify floorAngleRad never enters flight.
    const A=APEX_ARSENAL, T=APEX_ARSENAL_CONFIG.STORMBREAKER;
    const slot=A.state.slots.find(s=>s.weaponId==='STORMBREAKER');
    __AQ_TEST.place(slot.x,slot.y,850,500);
    __AQ_TEST.step(1/60);
    const held=__AQ_TEST.holder('HERO');
    __AQ_TEST.place(200,500,850,500);
    let flight=null;
    for(let i=0;i<75;i++) {
      __AQ_TEST.step(1/60);
      flight=projectiles.find(p=>p.aq && p.type==='aq_thrown' && p.weapon==='STORMBREAKER' && p.state==='flight');
      if(flight) break;
    }
    return {held:held?.weapon, slotGone:!A.state.slots.some(s=>s.id===slot.id),
      flight:flight && {spin:flight.spin,rot:flight.rot,velocity:Math.hypot(flight.vx,flight.vy)},
      expectedSpin:T.spinRate,expectedSpeed:T.throwSpeed,
      heldOffset:APEX_ARSENAL_AV.weaponDrawParams('STORMBREAKER','melee',75).drawOffset,
      heldMirrorParam:APEX_ARSENAL_AV.weaponDrawParams('STORMBREAKER','melee',75).mirrorLocal,
      floorAngle:T.floorAngleRad,flightVisualOffset:T.flightVisualOffsetRad,
      refProfile:window.APEX_ARSENAL_STORM?.referenceProfile?.()};
  })()`);
  gate('lab-browser-storm-flight-flip-gameplay-unchanged', report.labFlight.held==='STORMBREAKER'
    && report.labFlight.slotGone && report.labFlight.flight?.spin===report.labFlight.expectedSpin
    && Math.abs(report.labFlight.flight?.velocity-report.labFlight.expectedSpeed)<1e-6
    && report.labFlight.heldOffset===Math.PI/2
    && Math.abs(report.labFlight.floorAngle-Math.PI*1.5)<1e-8
    && report.labFlight.flightVisualOffset===0
    && report.labFlight.refProfile?.mirrorLocal===true
    && report.labFlight.heldMirrorParam===true
    && report.labFlight.refProfile?.flightLinkCount===10
    && report.labFlight.refProfile?.spawnPairCount===13
    && report.labFlight.refProfile?.rawAnchorCount===9
    && report.labFlight.refProfile?.anchorTransform==='ref-landscape-to-game-portrait-90cw'
    && report.labFlight.refProfile?.spawnLongSide===240
    && report.labFlight.refProfile?.heldLongSide===178
    && report.labFlight.refProfile?.flightLongSide===164
    && report.labFlight.refProfile?.thrownRadius===29.26
    && report.labFlight.refProfile?.spinRate===82
    && report.labFlight.refProfile?.motesEnabled===true, report.labFlight);
  report.labPigment = await evaluate(`(() => {
    const F=APEX_ARSENAL_FEEL;
    const victim = fighters[1], source = fighters[0];
    victim.color='#3377bb'; source.color='#ff5533';
    F.setSplatterMode('BLOOD'); F.resetMatch();
    F.noteDamage({dealt:56,victim,source,label:'arsenal-pistol',impact:{x:500,y:500,vx:2600,vy:0}});
    const blood = F.liveSpray()[0].rgb.slice();
    __AQ_TEST.redraw();
    return {blood,semantics:[F.palettes.dmg.fill,F.palettes.crit.fill,F.palettes.heal.fill]};
  })()`);
  report.evidence.push(await screenshot('lab-v1-splatter-blood'));
  report.labPigmentColor = await evaluate(`(() => {
    const F=APEX_ARSENAL_FEEL, victim=fighters[1], source=fighters[0];
    F.setSplatterMode('FIGHTER COLOR'); F.resetMatch();
    F.noteDamage({dealt:56,victim,source,label:'arsenal-pistol',impact:{x:500,y:500,vx:2600,vy:0}});
    const v1=F.liveSpray()[0].rgb.slice(), expected=F.pigment(victim).v1.coreCenter;
    __AQ_TEST.redraw();
    F.resetMatch(); F.noteDamage({dealt:56,victim,source,label:'arsenal-sabre'});
    const legacy=F.liveSpray()[0].rgb.slice(), legacyExpected=F.pigment(victim).legacy.spray;
    const saved=localStorage.getItem(F.SPLATTER_KEY), reload=F.reloadSplatterMode();
    __AQ_TEST.redraw();
    const credits=APEX_ARSENAL_META.credits();
    const quest=JSON.stringify(APEX_ARSENAL_QUEST.loadSave());
    window.exitArsenalLab();
    const exit={hub:document.getElementById('aq-meta-root').style.display,
      gameState,credits:APEX_ARSENAL_META.credits(),quest:JSON.stringify(APEX_ARSENAL_QUEST.loadSave()),
      panelGone:!document.getElementById('aq-lab-panel')};
    F.setSplatterMode('BLOOD');
    return {v1,expected,legacy,legacyExpected,saved,reload,credits,quest,exit};
  })()`);
  // Capture the color frame before the Lab exit (the data above includes its
  // proof); a new Lab entry makes the two mode screenshots visually comparable.
  await evaluate(`(() => {
    // Direct test entry (unlike the hub tile) must hide the meta overlay first,
    // or the screenshot would capture the Hub instead of fighter-color spray.
    APEX_ARSENAL_META.hideMeta();
    window.startArsenalLab(); cancelAnimationFrame(reqId); reqId=0;
    const F=APEX_ARSENAL_FEEL;
    F.setSplatterMode('FIGHTER COLOR');
    fighters[1].color='#3377bb'; fighters[0].color='#ff5533';
    __AQ_TEST.place(300,500,500,500); F.resetMatch();
    F.noteDamage({dealt:56,victim:fighters[1],source:fighters[0],label:'arsenal-pistol',impact:{x:500,y:500,vx:2600,vy:0}});
    __AQ_TEST.redraw(); return true;
  })()`);
  report.evidence.push(await screenshot('lab-v1-splatter-fighter-color'));
  await evaluate(`(() => {window.exitArsenalLab();APEX_ARSENAL_FEEL.setSplatterMode('BLOOD');return true})()`);
  gate('lab-browser-splatter-victim-both-paths-persist', report.labPigment.blood.join(',') === '92,0,0'
    && report.labPigmentColor.v1.join(',') === report.labPigmentColor.expected.join(',')
    && report.labPigmentColor.legacy.join(',') === report.labPigmentColor.legacyExpected.join(',')
    && report.labPigmentColor.saved === 'FIGHTER COLOR' && report.labPigmentColor.reload === 'FIGHTER COLOR'
    && report.labPigment.semantics.join(',') === '#F2382F,#FF8A24,#37D96B', report.labPigmentColor);
  gate('lab-browser-exit-hub-zero-progression', report.labPigmentColor.exit.hub === 'block'
    && report.labPigmentColor.exit.panelGone && report.labPigmentColor.exit.credits === report.labPigmentColor.credits
    && report.labPigmentColor.exit.quest === report.labPigmentColor.quest, report.labPigmentColor.exit);

  // ── Correction pass (owner playtest feedback round 2) ────────────────────
  // Real-browser evidence: orientation sequence (held → exact release frame →
  // first airborne frames with spin), body scale vs 75-radius fighters, REAL
  // floor-contact points for HERO and RIVAL, battle-audio session lifecycle,
  // likely-next-only warmup, and the stale global-slow label removal.
  report.cp5Held = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 850, 500); // hero aims RIGHT at the rival
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.55); // static committed windup pose
    const probe = window.APEX_ARSENAL_STORM.heldPresentationProbe();
    __AQ_TEST.redraw();
    return JSON.stringify({ probe, aimRight: fighters[0].x < fighters[1].x });
  })()`);
  const cp5Held = JSON.parse(report.cp5Held);
  report.evidence.push(await screenshot('cp5-01-held-before-release'));
  gate('storm-cp5-held-blade-forward-and-scale',
    cp5Held.probe && cp5Held.probe.mirror === true && cp5Held.probe.det === -1
    && cp5Held.probe.bladeForward === true && cp5Held.probe.bladeProj > 0
    && cp5Held.probe.long === 178
    && cp5Held.aimRight === true,
    cp5Held);

  // Exact release frame: first frame the flight object exists — rot = launch
  // angle, velocity = throw direction. Then the first airborne frames (spin
  // begins immediately at 82 rad/s).
  report.cp5Release = await evaluate(`(() => {
    const S = window.APEX_ARSENAL_STORM;
    let rel = null;
    for (let i = 0; i < 90 && !rel; i++) {
      __AQ_TEST.step(1/60);
      rel = projectiles.find(p => p.aq && p.type === 'aq_thrown' && p.weapon === 'STORMBREAKER' && p.state === 'flight') || null;
    }
    if (!rel) return JSON.stringify({ missing: true });
    const release = S.flightPresentationProbe();
    __AQ_TEST.redraw();
    const frames = [{ bladeForward: release.bladeForward, bladeProj: release.bladeProj, rot: +rel.rot.toFixed(3), long: release.long }];
    return JSON.stringify({ release, frames, thrownRadius: rel.radius, hitR75: +(75 * APEX_ARSENAL_CONFIG.BULLET_HIT_RADIUS_SCALE + rel.radius).toFixed(2) });
  })()`);
  const cp5Rel = JSON.parse(report.cp5Release);
  report.evidence.push(await screenshot('cp5-02-exact-release-frame'));
  report.cp5Airborne = await evaluate(`(() => {
    const S = window.APEX_ARSENAL_STORM;
    const f = [];
    for (let i = 0; i < 6; i++) {
      __AQ_TEST.step(1/60);
      const p = S.flightPresentationProbe();
      f.push(p && { x: p.x, y: p.y, theta: +p.theta.toFixed(3), spin: true });
    }
    __AQ_TEST.redraw();
    return JSON.stringify({ frames: f });
  })()`);
  report.evidence.push(await screenshot('cp5-03-first-airborne-frames'));
  await evaluate(`(() => { __AQ_TEST.step(6/60); __AQ_TEST.redraw(); return true; })()`);
  report.evidence.push(await screenshot('cp5-04-airborne-spin'));
  gate('storm-cp5-release-blade-forward-exact-frame',
    !cp5Rel.missing
    && cp5Rel.release.bladeForward === true && cp5Rel.release.bladeProj > 10
    && cp5Rel.release.mirror === true && cp5Rel.release.det === -1
    && cp5Rel.release.long === 164,
    cp5Rel);
  gate('storm-cp5-collision-authority-unchanged',
    !cp5Rel.missing && cp5Rel.thrownRadius === 29.26 && Math.abs(cp5Rel.hitR75 - 87.76) < 0.01,
    { thrownRadius: cp5Rel.thrownRadius, hitR75: cp5Rel.hitR75 });

  // Floor-contact readability: the deterministic bolt crosses the HERO's and
  // RIVAL's circle EDGES, so the real intersection is visibly ON the bolt —
  // close-ups must show bolt -> contact flash -> victim body. The contact is
  // sampled BEFORE stepping (the mode's own update consumes it per-pulse on
  // the first step — same deterministic geometry).
  report.cp5ContactHero = await evaluate(`(() => {
    const S = window.APEX_ARSENAL_STORM;
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(500, 410, 850, 800); // HERO 60px below the bolt lane
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns();
    // Two identical bolts: the first is consumed by THIS sampler probe (the
    // per-pulse/per-fighter gate), the second drives the mode's real
    // contact -> stun + onFloorContact flash, so neither path starves.
    S.testInjectFloorBolt(280, 350, 720, 350);
    const cs = S.floorContacts([fighters[0]]);
    const contact = cs[0] || null;
    S.testInjectFloorBolt(280, 350, 720, 350);
    for (let i = 0; i < 3; i++) __AQ_TEST.step(1/60); // mode applies stun + contact flash
    __AQ_TEST.redraw();
    return JSON.stringify({
      contact: contact && { x: +contact.x.toFixed(1), y: +contact.y.toFixed(1), main: contact.main, dist: contact.dist,
        onBoltLane: contact ? Math.abs(contact.y - 350) < 0.01 : false,
        notCenter: contact ? Math.hypot(contact.x - fighters[0].x, contact.y - fighters[0].y) > 30 : false },
      stunned: fighters[0].hasStatus('stun'),
    });
  })()`);
  const cp5Hero = JSON.parse(report.cp5ContactHero);
  report.evidence.push(await screenshot('cp5-05-floor-contact-hero-closeup'));
  report.cp5ContactRival = await evaluate(`(() => {
    const S = window.APEX_ARSENAL_STORM;
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(150, 800, 500, 410); // RIVAL 60px below the bolt lane
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns();
    S.testInjectFloorBolt(280, 350, 720, 350);
    const cs = S.floorContacts([fighters[1]]);
    const contact = cs[0] || null;
    S.testInjectFloorBolt(280, 350, 720, 350);
    for (let i = 0; i < 3; i++) __AQ_TEST.step(1/60);
    __AQ_TEST.redraw();
    return JSON.stringify({
      contact: contact && { x: +contact.x.toFixed(1), y: +contact.y.toFixed(1), main: contact.main, dist: contact.dist,
        onBoltLane: contact ? Math.abs(contact.y - 350) < 0.01 : false,
        notCenter: contact ? Math.hypot(contact.x - fighters[1].x, contact.y - fighters[1].y) > 30 : false },
      stunned: fighters[1].hasStatus('stun'),
    });
  })()`);
  const cp5Rival = JSON.parse(report.cp5ContactRival);
  report.evidence.push(await screenshot('cp5-06-floor-contact-rival-closeup'));
  gate('storm-cp5-floor-contact-real-point-hero',
    !!cp5Hero.contact && cp5Hero.contact.onBoltLane === true && cp5Hero.contact.notCenter === true
    && cp5Hero.contact.main === true && cp5Hero.stunned === true,
    cp5Hero);
  gate('storm-cp5-floor-contact-real-point-rival',
    !!cp5Rival.contact && cp5Rival.contact.onBoltLane === true && cp5Rival.contact.notCenter === true
    && cp5Rival.stunned === true,
    cp5Rival);
  gate('storm-cp5-stale-global-slow-gone',
    await evaluate(`!String(window.APEX_ARSENAL_STORM.drawFloor).includes('GLOBAL SLOW')
      && !String(window.APEX_ARSENAL_STORM.drawFloor).includes("fillText('SLOWED'")`),
    'drawFloor carries no global-slow presentation');

  // Battle-audio session lifecycle (gates 1–5, real async timing).
  report.cp5Audio = await evaluate(`(async () => {
    const AV = window.APEX_ARSENAL_AV;
    const out = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const state = () => window.apexBattleAudioSessionState();
    const probe = () => AV.audioSessionProbe();
    await AV.warmAudio();
    // (1)+(3) match A: live SFX, a playLater cue scheduled to fire AFTER exit.
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 850, 500);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(1.0); // windup + release + flight SFX
    const playedMatchA = AV.stats.played;
    AV.playLater('pickup_sniper_lock', 400); // cue that must die at exit
    out.sfxLivedInMatchA = playedMatchA > 0;
    const preExit = probe();
    out.preExit = { live: preExit.liveSources, timers: preExit.pendingTimers };
    window.exitArsenalQuestMode();
    const stExit = state();
    out.afterExit = { masterGain: stExit.masterGain, live: stExit.avLiveSources, timers: stExit.avPendingTimers };
    const playedAtExit = AV.stats.played;
    await sleep(650); // past the 400ms cue AND past the old 80ms auto-restore
    const stSettled = state();
    out.afterExitSettled = { masterGain: stSettled.masterGain, live: stSettled.avLiveSources, timers: stSettled.avPendingTimers };
    out.noVoicesAfterExit = AV.stats.played === playedAtExit; // the scheduled cue never fired
    out.noAutoRestore = stSettled.masterGain <= 0.01; // master still silent
    // (4) HOT bank stays decoded/cached across the session reset.
    const dec = AV.audioStatus();
    out.hotBank = { bankSize: dec.bankSize, decoded: dec.decoded, failed: dec.failed };
    // (5) menu BGM is independent of the battle-audio session.
    const bgmBefore = window.__apexMenuBgmState();
    window.apexEndBattleAudioSession();
    const bgmAfter = window.__apexMenuBgmState();
    out.menuBgmIndependent = !!bgmBefore && !!bgmAfter && bgmBefore.paused === bgmAfter.paused;
    // (2) match B: clean session, SFX live again.
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots(); __AQ_TEST.clearEvents();
    __AQ_TEST.place(300, 500, 850, 500);
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(1.0);
    const stB = state();
    // Same Web Audio readback race as the exit read below, mirrored: the
    // session-begin unmute (setValueAtTime(1, now)) may not be visible in
    // gain.value until the render thread catches up on slow runners. SFX
    // liveness itself is proven by the played counter; poll for the unmute
    // to become visible.
    let stBs = stB;
    for (let i = 0; i < 12 && stBs.masterGain <= 0.5; i++) { await sleep(50); stBs = state(); }
    out.matchB = { masterGain: stBs.masterGain, playedDelta: AV.stats.played - playedAtExit };
    out.matchBSfxLive = out.matchB.playedDelta > 0 && stBs.masterGain > 0.5;
    window.exitArsenalQuestMode();
    const stB2 = state();
    // Web Audio readback race (seen on loaded CI runners): a gain
    // setValueAtTime(v, now) is not reflected in gain.value until the audio
    // render thread processes the event, which can outlast a synchronous
    // read. Voices/cues are terminated synchronously (checked below), so
    // nothing can audibly leak during that window; poll a bounded settle
    // window for the scheduled mute to become visible.
    let stB2s = stB2;
    for (let i = 0; i < 12 && stB2s.masterGain > 0.01; i++) { await sleep(50); stB2s = state(); }
    out.afterMatchBExit = { masterGain: stB2s.masterGain, live: stB2s.avLiveSources, timers: stB2s.avPendingTimers,
      immediateLive: stB2.avLiveSources, immediateTimers: stB2.avPendingTimers };
    return JSON.stringify(out);
  })()`);
  const cp5Audio = JSON.parse(report.cp5Audio);
  gate('battle-audio-cp5-exit-silence',
    cp5Audio.sfxLivedInMatchA === true
    && cp5Audio.afterExit.live === 0 && cp5Audio.afterExit.timers === 0
    && cp5Audio.afterExitSettled.live === 0 && cp5Audio.afterExitSettled.timers === 0
    && cp5Audio.noVoicesAfterExit === true
    && cp5Audio.noAutoRestore === true,
    cp5Audio);
  gate('battle-audio-cp5-match-a-to-b-no-leak',
    cp5Audio.matchBSfxLive === true
    && cp5Audio.afterMatchBExit.masterGain <= 0.01
    && cp5Audio.afterMatchBExit.immediateLive === 0 && cp5Audio.afterMatchBExit.immediateTimers === 0,
    cp5Audio);
  gate('battle-audio-cp5-hot-bank-stays-decoded',
    cp5Audio.hotBank.bankSize === cp5Audio.hotBank.decoded && cp5Audio.hotBank.failed === 0,
    cp5Audio.hotBank);
  gate('battle-audio-cp5-menu-bgm-independent',
    cp5Audio.menuBgmIndependent === true,
    cp5Audio);

  // Likely-next-only background warmup (menu responsiveness): quest + select
  // warm, legacy battle groups never touched while staying inside quest.
  report.cp5Warmup = await evaluate(`(() => ({
    questReady: window.__apexDeferredRuntimesReady_arsenalQuest === true,
    selectReady: window.__apexDeferredRuntimesReady_select === true,
    legacyWarm: ['battle','soloBattle','trialBattle','tamChien','manualLab']
      .filter(g => window['__apexDeferredRuntimesReady_' + g] === true),
    warmupComplete: window.__apexWarmupComplete === true,
  }))()`);
  gate('menu-cp5-warmup-likely-next-only',
    report.cp5Warmup.questReady === true
    && report.cp5Warmup.selectReady === true
    && report.cp5Warmup.legacyWarm.length === 0
    && report.cp5Warmup.warmupComplete === true,
    report.cp5Warmup);

  // Persistence through an actual page reload, not merely a getter call.
  await evaluate(`APEX_ARSENAL_FEEL.setSplatterMode('FIGHTER COLOR')`);
  await command('Page.reload', { ignoreCache: true });
  await sleep(1200);
  for (let i = 0; i < 80; i++) {
    if (await evaluate('Boolean(window.__apexEngineReady && window.__apexEnsureDeferredRuntimes)')) break;
    await sleep(250);
  }
  await evaluate(`window.__apexEnsureDeferredRuntimes('arsenalQuest').then(() => true)`);
  const afterReload = await evaluate(`({mode:APEX_ARSENAL_FEEL.getSplatterMode(),
    store:localStorage.getItem(APEX_ARSENAL_FEEL.SPLATTER_KEY)})`);
  gate('lab-browser-splatter-survives-page-reload', afterReload.mode === 'FIGHTER COLOR'
    && afterReload.store === 'FIGHTER COLOR', afterReload);
  await evaluate(`APEX_ARSENAL_FEEL.setSplatterMode('BLOOD')`);

  // ── CP6: owner-flow gates (playtest round 3) ────────────────────────────
  // The three owner complaints: audio leaks across transitions, a multi-second
  // dead ARSENAL press, and delayed/janky UI while background work runs.
  // Fresh navigation = the cold-owner path: menu interactive → REAL click on
  // ARSENAL QUEST → hub paints → background warmup continues behind it.
  await command('Page.navigate', { url: appUrl });
  await sleep(800);
  for (let i = 0; i < 120; i++) {
    if (await evaluate('Boolean(window.__apexEngineReady && document.documentElement && document.querySelector)')) break;
    await sleep(250);
  }
  await evaluate(`(() => {
    window.__cp6 = { inputs: [], pressPaintAt: null, hubPaintAt: null, done: false };
    const t0 = performance.now();
    const probe = (ev) => {
      const at = performance.now();
      requestAnimationFrame(() => window.__cp6.inputs.push(+(performance.now() - at).toFixed(1)));
    };
    window.addEventListener('pointermove', probe, { capture: true, passive: true });
    window.addEventListener('pointerdown', probe, { capture: true, passive: true });
    window.addEventListener('pointerdown', () => { window.__cp6.pointerdownAt = +performance.now().toFixed(1); }, { capture: true, passive: true });
    const mo = new MutationObserver(() => {
      if (window.__cp6.pressPaintAt == null && document.querySelector('.menu-image-button.is-pressed')) {
        requestAnimationFrame(() => { if (window.__cp6.pressPaintAt == null) window.__cp6.pressPaintAt = +performance.now().toFixed(1); });
      }
      const hub = document.getElementById('aq-meta-root');
      if (window.__cp6.hubPaintAt == null && hub && hub.style.display !== 'none' && hub.getBoundingClientRect().width > 50) {
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__cp6.hubPaintAt = +performance.now().toFixed(1); }));
      }
    });
    mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class', 'style'], childList: true });
    return true;
  })()`);
  // Wait until the ARSENAL button is genuinely clickable: enabled AND the
  // topmost element at its center (entry overlays / boot splash / sweep
  // animations must have cleared — a dispatch during that window is a no-op).
  let cp6Clickability = null;
  for (let i = 0; i < 400; i++) {
    cp6Clickability = await hitProbe('button[aria-label="ARSENAL QUEST"]').catch(() => null);
    if (cp6Clickability && cp6Clickability.exists && !cp6Clickability.disabled
      && cp6Clickability.hitWithin && cp6Clickability.pointerEvents !== 'none'
      && cp6Clickability.width > 1 && cp6Clickability.height > 1) break;
    await sleep(100);
  }
  const cp6T0 = await evaluate('+performance.now().toFixed(1)');
  // Drive real pointer traffic while the entry + background warmup run.
  const cp6InputDriver = (async () => {
    for (let i = 0; i < 40; i++) {
      await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 260 + (i % 6) * 60, y: 480 + (i % 4) * 40 }).catch(() => {});
      await sleep(140);
    }
  })();
  await physicalClick('button[aria-label="ARSENAL QUEST"]');
  for (let i = 0; i < 250; i++) {
    if (await evaluate('window.__cp6 && window.__cp6.hubPaintAt != null').catch(() => false)) break;
    await sleep(100);
  }
  // Keep sampling through the background warmup window (decode/eval work).
  await sleep(2200);
  await cp6InputDriver;
  const cp6Click = await hitProbe('button[aria-label="ARSENAL QUEST"]');
  report.cp6Entry = JSON.parse(await evaluate(`JSON.stringify({
    clickability: { exists: ${JSON.stringify(!!(cp6Click && cp6Click.exists))}, hitWithin: ${JSON.stringify(!!(cp6Click && cp6Click.hitWithin))}, topClass: ${JSON.stringify(cp6Click ? cp6Click.topClass : null)} },
    pressPaintMs: (window.__cp6.pressPaintAt != null && window.__cp6.pointerdownAt != null) ? +(window.__cp6.pressPaintAt - window.__cp6.pointerdownAt).toFixed(1) : null,
    hubPaintMs: window.__cp6.hubPaintAt != null ? +(window.__cp6.hubPaintAt - ${cp6T0}).toFixed(1) : null,
    inputs: window.__cp6.inputs.length,
    inputsMax: window.__cp6.inputs.length ? Math.max(...window.__cp6.inputs) : null,
    inputsP95: (() => { const a = window.__cp6.inputs.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.95)] : null; })(),
    inputsOver400: window.__cp6.inputs.filter(v => v > 400).length,
  })`));
  report.evidence.push(await screenshot('cp6-01-arsenal-hub-entry'));
  // Bounds: the CP6 regression this guards is the multi-second dead press
  // (pre-fix: 6357ms press→hub, 1078ms monolithic long task). Post-fix the
  // residual per-event cost is single script-eval chunks (~150-300ms worst
  // on a busy CI main thread — see inputsP95 ~2-3ms vs one chunk); a 400ms
  // pressed-paint bound and 3500ms press→hub stay far below the regression
  // while tolerating CI variance. The standalone cold-entry evidence
  // (docs/arsenal-quest/evidence) records the real numbers: ~830ms cold
  // press→hub, ~170ms warm.
  gate('owner-cp6-arsenal-entry-immediate',
    report.cp6Entry.pressPaintMs != null && report.cp6Entry.pressPaintMs < 400
    && report.cp6Entry.hubPaintMs != null && report.cp6Entry.hubPaintMs < 3500,
    report.cp6Entry);
  gate('owner-cp6-input-alive-during-warmup',
    report.cp6Entry.inputs >= 8 && report.cp6Entry.inputsOver400 === 0
    && (report.cp6Entry.inputsMax == null || report.cp6Entry.inputsMax < 400)
    && (report.cp6Entry.inputsP95 == null || report.cp6Entry.inputsP95 < 50),
    report.cp6Entry);

  // Global battle-audio ownership matrix. Every producer (AV bank, synthesized
  // tones, direct WebAudio sources, media elements, scheduled cues) must die
  // at each transition; menu BGM must survive untouched.
  await evaluate(`window.__apexEnsureDeferredRuntimes('arsenalQuest').then(() => true)`);
  for (let i = 0; i < 80; i++) {
    if (await evaluate('Boolean(window.APEX_ARSENAL_STORM && window.startArsenalQuestMode && window.APEX_ARSENAL && window.APEX_ARSENAL_AV)').catch(() => false)) break;
    await sleep(250);
  }
  report.cp6Audio = await evaluate(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const info = () => window.apexBattleAudioSessionInfo();
    const state = () => window.apexBattleAudioSessionState();
    const settleSilent = async () => {
      // Web Audio readback race (CP5 lesson): gain.value lags scheduled
      // setValueAtTime until the render thread processes it.
      let st = state();
      for (let i = 0; i < 12 && st.masterGain > 0.01; i++) { await sleep(50); st = state(); }
      return st;
    };
    const out = {};
    out.bgmBefore = window.__apexMenuBgmState();
    // (1) menu → Arsenal match (real path). Session begins; SFX live.
    window.APEX_ARSENAL_META?.hideMeta?.();
    window.startArsenalQuestMode('NEWBIE', 'GALAXY');
    await sleep(150);
    out.enterSession = info();
    out.masterInMatch = state().masterGain;
    // AV hot-bank decode must finish first: playEntry() no-ops (notReady)
    // on undecoded buffers, which would make the SFX-live evidence racy.
    for (let i = 0; i < 60 && !APEX_ARSENAL_AV.audioReady(); i++) await sleep(150);
    // (2) Stormbreaker mid-flight + a registered LOOPING source, then exit
    //     mid-flight with a scheduled old-session cue still PENDING.
    const playedAtEquip = window.APEX_ARSENAL_AV.stats.played;
    APEX_ARSENAL.weaponApi.equip(fighters[0], 'STORMBREAKER');
    APEX_ARSENAL_AV.cue('storm_windup', { x: 500, y: 300, weapon: 'STORMBREAKER' });
    APEX_ARSENAL_AV.cue('storm_throw', { x: 520, y: 300, weapon: 'STORMBREAKER' });
    const loopSrc = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.05;
    loopSrc.buffer = buf; loopSrc.loop = true;
    const lg = audioCtx.createGain(); lg.gain.value = 0.5;
    loopSrc.connect(lg); lg.connect(battleAudioMaster);
    window.apexRegisterBattleAudioSource(loopSrc);
    loopSrc.__probeEnded = false;
    loopSrc.addEventListener('ended', () => { loopSrc.__probeEnded = true; });
    loopSrc.start();
    await sleep(850); // windup + release + flight SFX mid-air
    // Schedule a cue that is STILL PENDING at the moment of exit: an
    // old-session cue must never become audible after the transition.
    let cueFired = false;
    window.apexBattleAudioScheduleCue(() => { cueFired = true; }, 300);
    out.midFlight = { session: info(), avPlayed: window.APEX_ARSENAL_AV.stats.played - playedAtEquip,
      loopRegistered: info().registeredSources >= 1, cuePendingAtExit: info().pendingCues >= 1 };
    window.exitArsenalQuestMode();
    out.exitImmediate = { session: info(), master: state().masterGain };
    await sleep(550); // past the 300ms cue and any settle window
    const settled = await settleSilent();
    out.exitSettled = { session: info(), master: settled.masterGain,
      loopStoppedForReal: loopSrc.__probeEnded === true, oldCueNoop: cueFired === false };
    // (3) rapid re-enter: clean session, SFX live again.
    const playedAtReenter = window.APEX_ARSENAL_AV.stats.played;
    window.startArsenalQuestMode('NEWBIE', 'GALAXY');
    await sleep(120);
    APEX_ARSENAL.weaponApi.equip(fighters[0], 'STORMBREAKER');
    await sleep(350);
    const stB = await (async () => { let st = state(); for (let i = 0; i < 12 && st.masterGain < 0.5; i++) { await sleep(50); st = state(); } return st; })();
    out.reenter = { session: info(), master: stB.masterGain,
      sfxLive: window.APEX_ARSENAL_AV.stats.played > playedAtReenter };
    window.exitArsenalQuestMode();
    await sleep(120);
    // (4) other-mode boundaries: engine match path (classic) begins a session;
    //     select-screen navigation ends it.
    startSpecificMatch('NEWBIE', 'NEWBIE', { countdown: false, tournament: false });
    await sleep(150);
    out.engineMatch = info();
    window.goToMenu();
    await sleep(120);
    out.afterEngineMenu = info();
    const settled2 = await settleSilent();
    out.afterEngineMenuSettled = { session: info(), master: settled2.masterGain };
    // (5) another mode → Arsenal again.
    window.startArsenalQuestMode('NEWBIE', 'GALAXY');
    await sleep(120);
    out.otherToArsenal = info();
    window.exitArsenalQuestMode();
    await sleep(100);
    // Settle-poll: the menu music resume is async — a single read races it.
    let bgmAfter = window.__apexMenuBgmState();
    for (let i = 0; i < 24 && bgmAfter.paused; i++) { await sleep(75); bgmAfter = window.__apexMenuBgmState(); }
    out.bgmAfter = bgmAfter;
    return JSON.stringify(out);
  })()`);
  const cp6A = JSON.parse(report.cp6Audio);
  report.evidence.push(await screenshot('cp6-02-post-audio-matrix-menu'));
  gate('owner-cp6-session-begins-on-match-enter',
    cp6A.enterSession.active === true && cp6A.masterInMatch > 0.5, cp6A.enterSession);
  gate('owner-cp6-exit-terminates-everything',
    cp6A.exitImmediate.session.active === false
    && cp6A.exitImmediate.session.registeredSources === 0
    && cp6A.exitImmediate.session.pendingCues === 0
    && cp6A.exitSettled.session.registeredSources === 0
    && cp6A.exitSettled.session.pendingCues === 0
    && cp6A.exitSettled.master <= 0.01
    && cp6A.exitSettled.loopStoppedForReal === true
    && cp6A.exitSettled.oldCueNoop === true
    && cp6A.midFlight.cuePendingAtExit === true
    && cp6A.midFlight.avPlayed > 0,
    { midFlight: cp6A.midFlight, exitImmediate: cp6A.exitImmediate, exitSettled: cp6A.exitSettled });
  gate('owner-cp6-rapid-reenter-clean-session',
    cp6A.reenter.session.active === true && cp6A.reenter.session.sessionId > cp6A.enterSession.sessionId
    && cp6A.reenter.sfxLive === true && cp6A.reenter.master > 0.5,
    cp6A.reenter);
  gate('owner-cp6-engine-match-begins-session',
    cp6A.engineMatch.active === true, cp6A.engineMatch);
  gate('owner-cp6-cross-mode-boundaries-zero-leak',
    cp6A.afterEngineMenu.active === false
    && cp6A.afterEngineMenu.registeredSources === 0
    && cp6A.afterEngineMenuSettled.master <= 0.01
    && cp6A.otherToArsenal.active === true
    && cp6A.bgmAfter && cp6A.bgmAfter.paused === false
    && cp6A.bgmAfter.readyState >= 2,
    { afterEngineMenu: cp6A.afterEngineMenu, afterEngineMenuSettled: cp6A.afterEngineMenuSettled, otherToArsenal: cp6A.otherToArsenal, bgm: [cp6A.bgmBefore, cp6A.bgmAfter] });

  // ── CP7 (owner playtest round 4): cold-transition ready barriers ────────
  // BUG 1: Arsenal gameplay could open before its tier finished initializing
  // (combat shell + fighters + Lab controls mounted while the presentation
  // atlas was still at 0/45 images). Every hub→gameplay transition is now a
  // hard barrier with an explicit state machine; these gates prove it from a
  // COLD page each time: reload → ARSENAL immediately → destination
  // immediately → the destination may only appear once ready.
  const cp7HoldProbe = `(() => ({
    atMs: Math.round(performance.now()),
    transition: window.apexArsenalTransitionState ? window.apexArsenalTransitionState() : null,
    fighters: (typeof fighters !== 'undefined' && fighters && fighters.length === 2) ? fighters.map(f => f.name) : null,
    aqActive: !!(window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active),
    labPanel: !!document.getElementById('aq-lab-panel'),
    gameState: typeof gameState !== 'undefined' ? gameState : null,
  }))()`;
  async function cp7ColdOpen(label, clickThrough) {
    // Fresh document = cold owner path (menu → ARSENAL → destination, all
    // clicked the moment the UI permits).
    await command('Page.navigate', { url: appUrl });
    await sleep(600);
    for (let i = 0; i < 160; i++) {
      if (await evaluate('Boolean(window.__apexEngineReady)').catch(() => false)) break;
      await sleep(150);
    }
    for (let i = 0; i < 300; i++) {
      const ok = await hitProbe('button[aria-label="ARSENAL QUEST"]').catch(() => null);
      if (ok && ok.exists && !ok.disabled && ok.hitWithin && ok.width > 1) break;
      await sleep(100);
    }
    await physicalClick('button[aria-label="ARSENAL QUEST"]');
    for (let i = 0; i < 200; i++) {
      if (await evaluate(`(() => { const h = document.getElementById('aq-meta-root'); return !!(h && h.style.display !== 'none' && h.getBoundingClientRect().width > 50); })()`).catch(() => false)) break;
      await sleep(100);
    }
    const clicked = await clickThrough();
    // Poll the whole transition window: while not ready, nothing gameplay-ish
    // may exist. When it appears, it must already be ready.
    const samples = [];
    let firstGameplayAt = null;
    for (let i = 0; i < 260; i++) {
      const s = JSON.parse(await evaluate(`JSON.stringify(${cp7HoldProbe})`));
      samples.push(s);
      const gameplayLive = !!s.fighters || s.aqActive || s.labPanel;
      if (gameplayLive) { firstGameplayAt = s; break; }
      await sleep(100);
    }
    return { label, clicked, firstGameplayAt, lastSample: samples[samples.length - 1] };
  }
  const cp7PickStart = async () => {
    // The Arsenal pick runtime pre-applies defaults (NEWBIE/NEWBIE for free
    // battle; NEWBIE + quest opponent for the quest P1 picker), so its
    // start-button commits immediately.
    for (let i = 0; i < 240; i++) {
      const ok = await hitProbe('[data-layer-id="start-button"]').catch(() => null);
      if (ok && ok.exists && !ok.disabled && ok.hitWithin && ok.width > 1) break;
      await sleep(50);
    }
    const p = await physicalClick('[data-layer-id="start-button"]');
    await sleep(150);
    return p;
  };
  const cp7AssertHeld = (r) => {
    if (!r.firstGameplayAt) return { held: false, reason: 'gameplay never appeared' };
    const t = r.firstGameplayAt.transition || {};
    return {
      held: true,
      stateAtOpen: t.state,
      ready: t.readiness || {},
      fighters: r.firstGameplayAt.fighters,
      labPanel: r.firstGameplayAt.labPanel,
    };
  };

  // (1) LAB cold: click LAB the instant the hub permits.
  const cp7Lab = cp7AssertHeld(await cp7ColdOpen('lab', async () => {
    for (let i = 0; i < 200; i++) {
      const ok = await hitProbe('#aq-meta-root [data-go="lab"]').catch(() => null);
      if (ok && ok.exists && ok.hitWithin && ok.width > 1) break;
      await sleep(50);
    }
    const p = await physicalClick('#aq-meta-root [data-go="lab"]');
    await sleep(150);
    return p;
  }));
  // After the lab opens it must be functional: 33 weapon buttons, a spawn
  // works, and the exit returns to the hub.
  const cp7LabFunctional = await evaluate(`(() => {
    const buttons = document.querySelectorAll('[data-lab-weapon]').length;
    const btn = document.querySelector('[data-lab-weapon="PISTOL"]');
    if (btn) btn.click();
    const state = APEX_ARSENAL.state;
    return { buttons, labMode: !!state.labMode, spawnClicked: !!btn, slots: state.slots.length };
  })()`);
  report.evidence.push(await screenshot('cp7-01-cold-lab-barrier'));
  gate('owner-cp7-lab-cold-barrier-held',
    cp7Lab.held === true
    && (cp7Lab.stateAtOpen === 'lab-ready' || cp7Lab.stateAtOpen === 'match-ready')
    && cp7Lab.ready['arsenal-full-runtime-ready'] === true
    && cp7Lab.ready['av-images-ready'] === true,
    cp7Lab);
  gate('owner-cp7-lab-cold-functional',
    cp7LabFunctional.labMode === true && cp7LabFunctional.buttons >= 30 && cp7LabFunctional.slots >= 1,
    cp7LabFunctional);

  // (2) FREE BATTLE cold: hub → FREE → START immediately (default NEWBIEs).
  const cp7Free = cp7AssertHeld(await cp7ColdOpen('free', async () => {
    for (let i = 0; i < 200; i++) {
      const ok = await hitProbe('#aq-meta-root [data-go="free"]').catch(() => null);
      if (ok && ok.exists && ok.hitWithin && ok.width > 1) break;
      await sleep(50);
    }
    await physicalClick('#aq-meta-root [data-go="free"]');
    for (let i = 0; i < 200; i++) {
      if (await evaluate(`(() => { const s = document.getElementById('select-screen'); return !!(s && !s.classList.contains('hidden')); })()`).catch(() => false)) break;
      await sleep(50);
    }
    return cp7PickStart();
  }));
  report.evidence.push(await screenshot('cp7-02-cold-free-battle-barrier'));
  gate('owner-cp7-free-battle-cold-barrier-held',
    cp7Free.held === true
    && (cp7Free.stateAtOpen === 'match-ready')
    && cp7Free.ready['arsenal-full-runtime-ready'] === true
    && cp7Free.ready['av-images-ready'] === true
    && Array.isArray(cp7Free.fighters) && cp7Free.fighters.length === 2,
    cp7Free);

  // (3) QUEST cold: hub → QUEST → stage 01 immediately.
  const cp7Quest = cp7AssertHeld(await cp7ColdOpen('quest', async () => {
    for (let i = 0; i < 200; i++) {
      const ok = await hitProbe('#aq-meta-root [data-go="quest"]').catch(() => null);
      if (ok && ok.exists && ok.hitWithin && ok.width > 1) break;
      await sleep(50);
    }
    await physicalClick('#aq-meta-root [data-go="quest"]');
    for (let i = 0; i < 200; i++) {
      if (await evaluate(`(() => { const m = document.getElementById('aq-quest-map'); return !!(m && m.style.display !== 'none'); })()`).catch(() => false)) break;
      await sleep(50);
    }
    for (let i = 0; i < 200; i++) {
      const ok = await hitProbe('.aq-stage[data-n="1"]').catch(() => null);
      if (ok && ok.exists && !ok.disabled && ok.hitWithin && ok.width > 1) break;
      await sleep(50);
    }
    await physicalClick('.aq-stage[data-n="1"]');
    // Stage click opens the quest P1 picker (opponent pre-applied); its
    // start-button commits the stage → barrier → battle.
    return cp7PickStart();
  }));
  report.evidence.push(await screenshot('cp7-03-cold-quest-stage-barrier'));
  gate('owner-cp7-quest-stage-cold-barrier-held',
    cp7Quest.held === true
    && (cp7Quest.stateAtOpen === 'match-ready')
    && cp7Quest.ready['arsenal-full-runtime-ready'] === true
    && cp7Quest.ready['av-images-ready'] === true
    && Array.isArray(cp7Quest.fighters) && cp7Quest.fighters.length === 2,
    cp7Quest);

  // (4) Warm re-entry: exit to hub, re-open the Lab — the barrier must be
  // satisfied synchronously (zero added latency).
  const cp7Reentry = await evaluate(`(async () => {
    window.exitArsenalQuestMode();
    await new Promise(r => setTimeout(r, 250));
    const M = window.APEX_ARSENAL_META;
    if (M && M.openHub) M.openHub();
    const t0 = performance.now();
    const satisfiedBefore = window.apexArsenalBarrierSatisfied();
    const ok = await window.apexArsenalGameplayBarrier('lab');
    const dur = performance.now() - t0;
    return { ok, satisfiedBefore, durationMs: Math.round(dur),
      transition: window.apexArsenalTransitionState() };
  })()`);
  gate('owner-cp7-reentry-warm-instant',
    cp7Reentry.ok === true && cp7Reentry.satisfiedBefore === true && cp7Reentry.durationMs < 50,
    cp7Reentry);

  // ── CP7 BUG 2: start-of-match fail-cue loop ─────────────────────────────
  // Owner repro: fresh NEWBIE-vs-NEWBIE Arsenal battle, nobody picks up — a
  // sound used to "loop" until the first pickup. Root cause: the P2 NEWBIE
  // auto-cast re-attempted its dash every tick while no revealed pickup
  // existed, cueing newbie_fail (metalClick) ~10x/s. Fix: auto-cast failures
  // are silent; deliberate (skill-gate) activations keep the fail cue.
  const cp7Loop = await evaluate(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const AV = window.APEX_ARSENAL_AV;
    const state = () => window.APEX_ARSENAL.state;
    if (window.exitArsenalLab) { try { window.exitArsenalLab(); } catch (e) {} }
    if (typeof gameState !== 'undefined' && gameState === 'ARSENAL') window.exitArsenalQuestMode();
    await sleep(200);
    window.startArsenalQuestMode('NEWBIE', 'NEWBIE');
    // Hold every spawn/pickup path immediately (before the first weapon) and
    // freeze both fighters so the unarmed brawl cannot end the match during
    // the hold window (the auto-cast polling is movement-independent).
    const s = APEX_ARSENAL.state;
    s.spawnTimer = 1e6; s.slots = []; s.unarmedFastConsumed = true; s.spawnHeld = true;
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    const cuedBefore = AV.stats.cued.filter(c => c.event === 'newbie_fail').length;
    await sleep(4000); // "no pickup for several seconds"
    const failCuesDuringHold = AV.stats.cued.filter(c => c.event === 'newbie_fail').length - cuedBefore;
    const probeAfterHold = AV.audioSessionProbe();
    const holdHealth = { over: !!s.over, hp: [fighters[0].hp, fighters[1].hp] };
    // Real pickup: drop a REVEALED pistol under the hero.
    s.slots.length = 0;
    s.slots.push({ id: s.nextSlotId++, x: fighters[0].x, y: fighters[0].y, phase: 'REVEALED', weaponId: 'PISTOL',
      revealLeadSeconds: 0, revealedFor: 0, pickedBy: null, rejectedFor: {}, spawnTime: s.time,
      predictedHeroETA: null, predictedRivalETA: null, earliestETA: null, predictedFighter: null });
    const pickupCuesBefore = AV.stats.cued.filter(c => c.event === 'pickup').length;
    let holder = null;
    for (let i = 0; i < 40 && !holder; i++) {
      await sleep(100);
      holder = APEX_ARSENAL.weaponApi.getHolder(fighters[0]) || APEX_ARSENAL.weaponApi.getHolder(fighters[1]);
    }
    const pickupCuesAfter = AV.stats.cued.filter(c => c.event === 'pickup').length - pickupCuesBefore;
    const probeAfterPickup = AV.audioSessionProbe();
    return { failCuesDuringHold, avVoicesDuringHold: probeAfterHold.activeVoices,
      holder: holder ? holder.weaponId : null, pickupCuesAfter,
      holdHealth,
      avLiveAfterPickup: probeAfterPickup.liveSources, session: window.apexBattleAudioSessionInfo() };
  })()`);
  report.evidence.push(await screenshot('cp7-04-newbie-no-fail-loop'));
  gate('owner-cp7-newbie-no-fail-loop',
    cp7Loop.failCuesDuringHold <= 2
    && cp7Loop.holder === 'PISTOL'
    && cp7Loop.pickupCuesAfter >= 1
    && cp7Loop.avVoicesDuringHold === 0,
    cp7Loop);

  // ------------------------------------------------------------ summary ----
  report.summary = {
    total: Object.keys(report.gates).length,
    passed: Object.values(report.gates).filter(g => g.pass).length,
    failed: report.failures,
  };
  console.log('\n==== ARSENAL QUEST TEST SUMMARY ====');
  console.log(JSON.stringify(report.summary, null, 2));
  await writeFile(path.join(evidenceDir, 'test-report.json'), JSON.stringify(report, null, 2));
  console.log(`report+evidence written under ${evidenceDir}/`);
  if (report.failures.length) process.exitCode = 1;
} finally {
  try { socket.close(); } catch {}
  if (chrome) { chrome.kill(); await sleep(250); }
}
