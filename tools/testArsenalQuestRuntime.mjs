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

  // Test-side helpers installed in the page.
  await evaluate(`(() => {
    window.__AQ_TEST = {
      enterManual() {
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
    APEX_ARSENAL.weaponApi.equip(fighters[0], 'PISTOL');
    const armedBefore = APEX_ARSENAL.state.spawnedTotal;
    __AQ_TEST.step(1/60);
    const afterOneArmed = APEX_ARSENAL.state.spawnedTotal;
    // Current V3 emergency law requires both fighters to lack a firearm AND
    // no REVEALED firearm floor pickup. Remove the first emergency slot so
    // this block creates a real false -> true retrigger instead of depending
    // on incidental slot phase/timing.
    __AQ_TEST.clearSlots();
    fighters[0].data.arsenal = null;
    fighters[1].data.arsenal = null; // rival may collect the first emergency slot
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
  gate('feel-rifle-pickup-derived', report.bothUnarmed.ak && String(report.bothUnarmed.ak.rel).indexOf('rifle_take_01.wav') >= 0, report.bothUnarmed.ak);
  gate('feel-pistol-source-recharge', report.bothUnarmed.pistol && String(report.bothUnarmed.pistol.rel).indexOf('pickup_pistol.wav') >= 0, report.bothUnarmed.pistol);


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
    // Screenshot: unclaimed floor — arena lightning, spawn aura, slow rings.
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

  // Confirmed hit: 546 damage (52 x 1.5 x 7), real stun, knockback status,
  // weapon vanishes (no pin). Frame-poll the 0.18s push inside the stun.
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
  gate('storm-browser-hit-546-stun-no-pin',
    report.stormHit.rivalHp === 454 && report.stormHit.sawStun === true
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

  // Flight screenshot: spinning weapon + rotational ghosts + local arcs.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.place(120, 120, 980, 120);
    __AQ_TEST.holdSpawns();
    __AQ_TEST.equip('HERO', 'STORMBREAKER');
    __AQ_TEST.step(0.80); // release at 0.73s -> mid-flight, far from rival
    __AQ_TEST.redraw();
    return projectiles.some(p => p.aq && p.type === 'aq_thrown' && p.weapon === 'STORMBREAKER');
  })()`);
  report.evidence.push(await screenshot('10d-storm-flight-spin-ghosts'));

  // Global slow: both fighters 0.70x while unclaimed, clean on pickup.
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
  gate('storm-browser-floor-slows-both',
    report.stormSlow.slowHero === true && report.stormSlow.slowRival === true && report.stormSlow.mult === 0.70,
    report.stormSlow);
  gate('storm-browser-slow-clean-removal',
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
      floorAngle:T.floorAngleRad,flightVisualOffset:T.flightVisualOffsetRad,
      refProfile:window.APEX_ARSENAL_STORM?.referenceProfile?.()};
  })()`);
  gate('lab-browser-storm-flight-flip-gameplay-unchanged', report.labFlight.held==='STORMBREAKER'
    && report.labFlight.slotGone && report.labFlight.flight?.spin===report.labFlight.expectedSpin
    && Math.abs(report.labFlight.flight?.velocity-report.labFlight.expectedSpeed)<1e-6
    && report.labFlight.heldOffset===Math.PI/2
    && Math.abs(report.labFlight.floorAngle-Math.PI*1.5)<1e-8
    && Math.abs(report.labFlight.flightVisualOffset-Math.PI)<1e-8
    && report.labFlight.refProfile?.flightLinkCount===10
    && report.labFlight.refProfile?.spawnPairCount===13, report.labFlight);
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
