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
      hp() { return { hero: fighters[0].hp, rival: fighters[1].hp }; },
      holder(who) {
        const f = who === 'HERO' ? fighters[0] : fighters[1];
        const h = APEX_ARSENAL.weaponApi.getHolder(f);
        return h ? { weapon: h.weaponId, phase: h.phase, shots: h.shotsFired, elapsed: h.elapsed } : null;
      },
      equip(who, weaponId) {
        APEX_ARSENAL.weaponApi.equip(who === 'HERO' ? fighters[0] : fighters[1], weaponId);
      },
      holdSpawns() { APEX_ARSENAL.state.spawnTimer = 1e6; APEX_ARSENAL.state.slots = []; },
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
    && report.entry.hero.hp === 100 && report.entry.rival.hp === 100
    && report.entry.hero.weapon === 'NONE' && report.entry.rival.weapon === 'NONE'
    && report.entry.menuHidden, report.entry);

  // ---------------------------------------------------- spawn law ---------
  report.spawnLaw = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(90, 90, 910, 910);
    const leads = {};
    for (let t = 0; t < 10; t += 0.1) {
      __AQ_TEST.step(0.1);
      for (const slot of APEX_ARSENAL.state.slots) {
        if (slot.phase === 'TELEGRAPH') leads[slot.id] = slot.revealLeadSeconds;
      }
    }
    const d = __AQ_TEST.debug();
    const leadValues = Object.values(leads);
    return {
      spawnedTotal: d.spawnedTotal,
      maxActive: d.maxActiveSlots,
      leadValues,
      // V2 §A5: fixed 1.0s centerline lead for every telegraph.
      leadsFixedOne: leadValues.length >= 3 && leadValues.every(v => Math.abs(v - 1.0) < 1e-9),
      spawnEvents: __AQ_TEST.countEvents('SPAWN_SLOT'),
      revealEvents: __AQ_TEST.countEvents('REVEAL'),
      allHiddenIdentityNull: d.slots.filter(s => s.phase === 'TELEGRAPH').every(s => s.weaponId === null),
      longHiddenCount: d.slots.filter(s => s.phase === 'TELEGRAPH' && s.age >= 5 && s.weaponId === null).length,
    };
  })()`);
  gate('spawn-cadence-independent', report.spawnLaw.spawnedTotal >= 4 && report.spawnLaw.spawnEvents >= 4,
    `spawnedTotal=${report.spawnLaw.spawnedTotal} over 10s (cadence 3.0s, first 1.0s)`);
  gate('centerline-lead-fixed-1.0', report.spawnLaw.leadsFixedOne, report.spawnLaw.leadValues.map(v => v.toFixed(2)));
  gate('multi-slot-coexist', report.spawnLaw.maxActive >= 3, `maxActiveSlots=${report.spawnLaw.maxActive}`);
  gate('no-age-based-reveal-while-far', report.spawnLaw.longHiddenCount >= 1 && report.spawnLaw.allHiddenIdentityNull,
    `longHidden=${report.spawnLaw.longHiddenCount} reveals=${report.spawnLaw.revealEvents}`);

  // ------------------------------------- telegraph law (proximity reveal) ---
  report.telegraphLaw = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.place(400, 500, 900, 900);
    const id = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });

    __AQ_TEST.step(6.1);
    let slot = APEX_ARSENAL.state.slots.find(s => s.id === id) || null;
    const hiddenAfter6s = !!slot && slot.phase === 'TELEGRAPH' && slot.weaponId === null;
    const before = __AQ_TEST.debug().slots.find(s => s.id === id) || null;

    fighters[0].baseSpeed = 520;
    fighters[0].setDir(1, 0);
    fighters[1].baseSpeed = 0;
    __AQ_TEST.step(0.04);

    slot = APEX_ARSENAL.state.slots.find(s => s.id === id) || null;
    const revealedOnApproach = !!slot && slot.phase === 'REVEALED' && !!slot.weaponId;
    const revealLog = __AQ_TEST.events().find(e => e.startsWith('[AQ] REVEAL') && e.includes('id=' + id)) || '';

    __AQ_TEST.step(1.5);
    return {
      hiddenAfter6s,
      before,
      revealedOnApproach,
      revealLog,
      finalHolder: __AQ_TEST.holder('HERO'),
      pickupEvent: __AQ_TEST.countEvents('PICKUP', 'fighter=HERO'),
    };
  })()`);
  gate('telegraph-not-collectible-and-long-hidden',
    report.telegraphLaw.hiddenAfter6s && report.telegraphLaw.before?.age >= 6 && report.telegraphLaw.before?.weaponId === null,
    report.telegraphLaw.before);
  gate('telegraph-no-identity', report.telegraphLaw.before?.weaponId === null);
  gate('centerline-reveal-on-aligned-approach',
    report.telegraphLaw.revealedOnApproach && /eta=\d+\.\d+/.test(report.telegraphLaw.revealLog)
      && /lead=1\.00/.test(report.telegraphLaw.revealLog) && /fighter=HERO/.test(report.telegraphLaw.revealLog),
    report.telegraphLaw.revealLog);
  gate('reveal-then-collectible', report.telegraphLaw.pickupEvent === 1,
    report.telegraphLaw.revealLog || JSON.stringify(report.telegraphLaw.finalHolder));

  // ------------------------- V2 §A5 negatives: graze + pre-bounce stay hidden --
  report.centerlineNeg = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    __AQ_TEST.clearEvents();
    __AQ_TEST.place(400, 500, 900, 200);
    const grazeId = __AQ_TEST.pushSlot({ x: 850, y: 570, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0); fighters[1].baseSpeed = 0;
    __AQ_TEST.step(1.2);
    const graze = APEX_ARSENAL.state.slots.find(s => s.id === grazeId) || null;
    const grazeStayedHidden = !!graze && graze.phase === 'TELEGRAPH' && graze.weaponId === null;

    __AQ_TEST.place(900, 500, 300, 200);
    const bounceId = __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0); fighters[1].baseSpeed = 0;
    __AQ_TEST.step(0.03);
    const preBounce = APEX_ARSENAL.state.slots.find(s => s.id === bounceId) || null;
    const hiddenBeforeBounce = !!preBounce && preBounce.phase === 'TELEGRAPH' && preBounce.weaponId === null;
    __AQ_TEST.step(0.35);
    const postBounce = APEX_ARSENAL.state.slots.find(s => s.id === bounceId) || null;
    const revealedAfterBounce = !postBounce || postBounce.phase === 'REVEALED';
    return { grazeStayedHidden, hiddenBeforeBounce, revealedAfterBounce };
  })()`);
  gate('centerline-graze-stays-hidden', report.centerlineNeg.grazeStayedHidden, report.centerlineNeg);
  gate('centerline-no-reveal-before-bounce', report.centerlineNeg.hiddenBeforeBounce && report.centerlineNeg.revealedAfterBounce, report.centerlineNeg);

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
    __AQ_TEST.pushSlot({ x: 700, y: 500, weaponId: 'SABRE' });
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
  gate('rival-can-collect', report.pickupRules.rivalGot === 'SABRE');
  gate('hero-can-collect', report.pickupRules.heroGot === 'SMG');
  gate('armed-fighter-cannot-vacuum', report.pickupRules.rejectedStillThere && report.pickupRules.rejectLogged && report.pickupRules.heroStillArmedWith === 'SMG');

  // ------------------------------------------------ soft cap suppression ---
  report.softCap = await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearEvents();
    __AQ_TEST.clearSlots();
    for (let i = 0; i < 8; i++) __AQ_TEST.pushSlot({ x: 100 + i * 100, y: 200, weaponId: 'PISTOL' });
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
        damageDealt: +(100 - hp.rival).toFixed(1),
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
  gate('grenade-resolves-after-fuse', report.grenade.rivalHpAfter < 100 && report.grenade.explodeLogged && report.grenade.grenadeGone, `rivalHp=${report.grenade.rivalHpAfter}`);

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
  gate('melee-not-wasted-out-of-range', report.meleeWait.farState.holder && report.meleeWait.farState.holder.weapon === 'BATTLE_AXE' && report.meleeWait.farState.rivalHp === 100);
  gate('melee-activates-in-range', report.meleeWait.nearState.holder === null && report.meleeWait.nearState.rivalHp < 100);

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
  gate('swirl-reflects-projectile', report.swirl.reflectLogged && report.swirl.heroHp === 100 && report.swirl.rivalHp < 100 && report.swirl.heroHolder === null,
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
  gate('tower-shield-reduces-damage', report.tower.guardedHp === 97.5 && report.tower.unguardedDelta === 10,
    `withShield 10->${100 - report.tower.guardedHp}, without 10->${report.tower.unguardedDelta}`);
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

  // ------------------------- V2 §A3: 32 canonical shells, kits disabled -------
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
  gate('shells-32-canonical', report.shells.count === 32, { count: report.shells.count });
  gate('shells-p1-p2-independent',
    report.shells.names[0] === 'SNIPER' && report.shells.names[1] === 'WITCH' && report.shells.shellFlags.every(Boolean),
    report.shells.names);
  gate('shells-native-kits-disabled', report.shells.nativeProj === 0 && report.shells.hp.every(h => h === 100), report.shells);

  // ------------------------------------------------- F3 overlay + screenshots
  report.f3 = await evaluate(`(() => {
    __AQ_TEST.enterLive();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3', bubbles: true, cancelable: true }));
    const on = APEX_ARSENAL.state.debugOverlay;
    return { toggledOn: on };
  })()`);
  gate('f3-debug-overlay-toggle', report.f3.toggledOn === true);

  // Issue #4: real-browser proof that the committed atlas renders (floor +
  // equipped) and the old placeholder path is not serving weapon art.
  report.weaponArt = await evaluate(`(async () => {
    __AQ_TEST.enterManual();
    __AQ_TEST.clearSlots();
    __AQ_TEST.place(300, 500, 760, 500);
    __AQ_TEST.pushSlot({ x: 300, y: 430, weaponId: 'SHOTGUN' });
    __AQ_TEST.pushSlot({ x: 520, y: 620, weaponId: 'TOWER_SHIELD' });
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
  gate('browser-weapon-atlas-floor-sprite', report.weaponArt.floor >= 2, report.weaponArt);
  gate('browser-weapon-atlas-equipped-sprite', report.weaponArt.equipped >= 2, report.weaponArt);
  gate('browser-no-atlas-fallback', report.weaponArt.imgFail === 0 && report.weaponArt.floor > 0, report.weaponArt);

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
  const shellSelect = await evaluate(`(async () => {
    window.beginArsenalQuestSelection();
    await new Promise(r => setTimeout(r, 400));
    const t = window.__APEX_PICK_TEST;
    const count = t ? t.roster().length : 0;
    if (t) t.confirmByName('SNIPER');
    await new Promise(r => setTimeout(r, 100));
    if (t) t.confirmByName('WITCH');
    await new Promise(r => setTimeout(r, 100));
    return {
      count,
      p1: p1Selection && p1Selection.name,
      p2: p2Selection && p2Selection.name,
      selectVisible: !document.getElementById('select-screen').classList.contains('hidden'),
    };
  })()`);
  gate('shell-select-32-cards', shellSelect.count === 32 && shellSelect.selectVisible, shellSelect);
  gate('shell-select-p1-p2-locks', shellSelect.p1 === 'SNIPER' && shellSelect.p2 === 'WITCH', shellSelect);
  report.evidence.push(await screenshot('16-v2-shell-select-locked'));
  const shellEnter = await evaluate(`(async () => {
    document.querySelector('.apex-pick-button[aria-label="start-button"]')?.click();
    const t0 = Date.now();
    while (gameState !== 'ARSENAL' && Date.now() - t0 < 6000) await new Promise(r => setTimeout(r, 100));
    cancelAnimationFrame(reqId); reqId = 0;
    return { gameState, names: fighters.map(f => f.name), shells: fighters.map(f => !!f.type.arsenalShell) };
  })()`);
  gate('shell-select-enters-arsenal', shellEnter.gameState === 'ARSENAL'
    && shellEnter.names[0] === 'SNIPER' && shellEnter.names[1] === 'WITCH'
    && shellEnter.shells.every(Boolean), shellEnter);
  report.evidence.push(await screenshot('16b-v2-shells-in-arena'));

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

  // V2 evidence 18: strict centerline reveal on an aligned trajectory.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    fighters[0].x = 400; fighters[0].y = 500; fighters[1].x = 900; fighters[1].y = 150;
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.pushSlot({ x: 850, y: 500, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.1);
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('18-v2-centerline-reveal'));

  // V2 evidence 19: grazing trajectory stays a hidden telegraph.
  await evaluate(`(() => {
    __AQ_TEST.enterManual();
    __AQ_TEST.holdSpawns();
    fighters[0].x = 400; fighters[0].y = 500; fighters[1].x = 900; fighters[1].y = 150;
    fighters[0].baseSpeed = 0; fighters[1].baseSpeed = 0;
    __AQ_TEST.pushSlot({ x: 850, y: 570, phase: 'TELEGRAPH', weaponId: null, revealLeadSeconds: 1.0 });
    fighters[0].baseSpeed = 520; fighters[0].setDir(1, 0);
    __AQ_TEST.step(0.8);
    __AQ_TEST.redraw();
    return true;
  })()`);
  report.evidence.push(await screenshot('19-v2-graze-stays-hidden'));

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
