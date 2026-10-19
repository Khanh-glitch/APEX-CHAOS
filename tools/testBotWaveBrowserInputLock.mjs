// BOT WAVE browser regression — input card-lock + Sticky J (F1 closeout).
//
// Proof level: BROWSER ACCEPTANCE. Drives the exact production document the
// App mounts (/bot-wave/game.html) in real Chrome with real keyboard/mouse
// input and asserts runtime behavior:
//   * fresh run: U/I touch pads are disabled+LOCK, and real U/I/Digit5/
//     Digit0 key presses produce ZERO engine castSkill calls (card lock);
//   * J/K are alive (native basic attack route + hold-K guard state);
//   * Sticky J: a real J press at a 275px gap engages the assisted native
//     dash (pilot stickyStats attempts/engaged advance);
//   * the real level-up economy (pilot testForceXP seam -> production
//     presentCards DOM -> real card clicks) unlocks jab->uppercut->counter
//     ->phantom->ult; afterwards U/I pads enable and real U/I presses cast.
//
// Scope honesty: this test loads game.html directly (the document App.jsx
// mounts in its iframe). It does NOT prove the Home -> BOT WAVE door
// transition; that route is covered by tools/testBoxeModeEntryChrome.mjs
// (Chrome Home entry acceptance), not by this file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const url = (process.env.APEX_APP_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = process.env.APEX_EVIDENCE_DIR || 'docs/boxe/f1-browser';
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e?.stack || e)));
await page.setViewport({ width: 1440, height: 900 });
const probe = (fn) => page.evaluate(fn);
async function until(label, fn, timeout = 15000, arg) {
  const t0 = Date.now();
  for (;;) {
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    if (Date.now() - t0 > timeout) throw Error('TIMEOUT waiting for ' + label);
    await sleep(50);
  }
}

try {
  await page.goto(url + '/bot-wave/game.html', { waitUntil: 'domcontentloaded', timeout: 65000 });
  await until('pilot+engine boot', () => !!window.BOXE_WAVE_PILOT && !!window.handLab && !!window.APEX_BOT_WAVE_CAMPAIGN, 30000);
  await page.waitForSelector('#w-go', { visible: true, timeout: 20000 });
  await page.click('#w-go');
  await until('combat phase', () => window.BOXE_WAVE_PILOT.state.phase === 'combat', 20000);

  // Pass-through cast recorder on the real engine (observation, not a mock).
  await probe(() => {
    const E = window.handLab;
    window.__casts = [];
    const orig = E.castSkill.bind(E);
    E.castSkill = (...a) => { window.__casts.push(a[0]); return orig(...a); };
  });

  // --- Card lock: fresh run -------------------------------------------------
  const fresh = await probe(() => {
    const P = window.BOXE_WAVE_PILOT;
    const btn = (q) => { const b = document.querySelector(q); return b ? { disabled: b.disabled, text: b.textContent } : null; };
    return { owned: P.keys(), U: btn('[data-act="U"]'), I: btn('[data-act="I"]'), J: btn('[data-act="J"]') };
  });
  assert.deepEqual(fresh.owned, [], 'fresh run must own no unlock cards');
  assert.equal(fresh.U.disabled, true, 'U pad must start disabled');
  assert.equal(fresh.I.disabled, true, 'I pad must start disabled');
  assert.ok(/LOCK/.test(fresh.U.text) && /LOCK/.test(fresh.I.text), 'U/I pads must render LOCK');
  assert.equal(fresh.J.disabled, false, 'J pad must start enabled');
  await page.screenshot({ path: output + '/01-locked-combat.png' });
  for (const k of ['u', 'i', '5', '0']) await page.keyboard.press(k);
  await sleep(350);
  assert.deepEqual(await probe(() => window.__casts), [],
    'locked U/I and digit hotkeys must never reach castSkill');
  console.log('BROWSER card-lock PASS: fresh U/I locked on pads+keyboard, digits swallowed, zero casts');

  // --- J/K positive controls ------------------------------------------------
  await page.keyboard.down('k');
  await until('guard held', () => window.BOXE_WAVE_PILOT.state.guardHeld === true, 3000);
  await page.keyboard.up('k');
  await until('guard released', () => window.BOXE_WAVE_PILOT.state.guardHeld === false, 3000);

  // --- Sticky J: deterministic geometry through the exposed engine ----------
  await until('a live enemy', () => window.handLab.enemies.some((e) => !e.dead), 20000);
  const arranged = await probe(() => {
    const E = window.handLab, S = window.BOXE_WAVE_PILOT.state, p = E.player;
    const alive = E.enemies.filter((e) => !e.dead);
    for (const e of alive.slice(1)) E.damageEnemy(e, e.hp + 1000, { quiet: true });
    const t = E.enemies.find((e) => !e.dead);
    if (!t) return null;
    t.x = p.x + (275 + t.r); t.y = p.y; t.vx = 0; t.vy = 0;
    p.vx = 0; p.vy = 0; p.basicCd = 0; p.dashCd = 0; p.dashT = 0;
    S.comboFlow = null;
    return { gap: Math.hypot(t.x - p.x, t.y - p.y) - t.r, attempts: S.stickyStats.attempts, engaged: S.stickyStats.engaged };
  });
  assert.ok(arranged && Math.abs(arranged.gap - 275) < 1, 'sticky fixture gap must be 275');
  await page.keyboard.press('j');
  await until('sticky engaged', (a) => window.BOXE_WAVE_PILOT.state.stickyStats.engaged > a, 3000, arranged.engaged)
    .catch(async () => {
      const s = await probe(() => ({ ...window.BOXE_WAVE_PILOT.state.stickyStats }));
      throw Error('Sticky J did not engage at 275px gap: ' + JSON.stringify(s));
    });
  const stickyAfter = await probe(() => ({ ...window.BOXE_WAVE_PILOT.state.stickyStats }));
  assert.ok(stickyAfter.attempts > arranged.attempts, 'sticky attempts must advance');
  await page.screenshot({ path: output + '/02-sticky-engage.png' });
  console.log('BROWSER Sticky J PASS: real J press engaged assisted native dash', JSON.stringify(stickyAfter));
  await sleep(800);

  // --- Real economy: unlock chain through production offer DOM --------------
  const TARGETS = ['jab', 'uppercut', 'counter', 'phantom', 'ult'];
  let firstOfferShot = false;
  for (let step = 0; step < 40; step++) {
    const st = await probe(() => {
      const P = window.BOXE_WAVE_PILOT;
      return { phase: P.state.phase, owned: P.keys(), offer: P.state.offer?.map((c) => c.id) || null };
    });
    if (TARGETS.every((t) => st.owned.includes(t)) && st.phase === 'combat') break;
    assert.ok(st.phase === 'combat' || st.phase === 'upgrade', 'unexpected phase during unlock loop: ' + st.phase);
    if (st.phase === 'combat') {
      await probe(() => { const P = window.BOXE_WAVE_PILOT; P.testForceXP(P.xpNeeded(P.state.level)); });
      await until('upgrade offer', () => window.BOXE_WAVE_PILOT.state.phase === 'upgrade' && !!window.BOXE_WAVE_PILOT.state.offer, 5000);
    }
    const offer = await probe(() => window.BOXE_WAVE_PILOT.state.offer.map((c) => c.id));
    assert.equal(offer.length, 3, 'offer must present exactly 3 cards');
    assert.equal(new Set(offer).size, 3, 'offer cards must be distinct');
    if (!firstOfferShot) { await page.screenshot({ path: output + '/03-upgrade-offer.png' }); firstOfferShot = true; }
    const ownedNow = await probe(() => window.BOXE_WAVE_PILOT.keys());
    const pick = offer.find((id) => TARGETS.includes(id) && !ownedNow.includes(id)) ?? offer[0];
    const btns = await page.$$('#w-cards .w-card');
    assert.equal(btns.length, 3, 'offer DOM must render 3 card buttons');
    await btns[offer.indexOf(pick)].click();
    await sleep(180);
    if (step === 39) throw Error('unlock chain did not complete within 40 level-ups; owned=' + JSON.stringify(ownedNow));
  }
  await until('back to combat after unlocks', () => window.BOXE_WAVE_PILOT.state.phase === 'combat', 8000);
  const unlocked = await probe(() => {
    const btn = (q) => document.querySelector(q)?.disabled;
    return { owned: window.BOXE_WAVE_PILOT.keys(), uDisabled: btn('[data-act="U"]'), iDisabled: btn('[data-act="I"]') };
  });
  for (const t of TARGETS) assert.ok(unlocked.owned.includes(t), 'chain card must be owned: ' + t);
  assert.equal(unlocked.uDisabled, false, 'U pad must enable after phantom');
  assert.equal(unlocked.iDisabled, false, 'I pad must enable after ult');
  console.log('BROWSER unlock chain PASS: jab->uppercut->counter->phantom->ult via real offers');

  // --- Positive casts through the real router --------------------------------
  await probe(() => { window.__casts.length = 0; });
  await page.keyboard.press('u');
  await until('phantom cast', () => window.__casts.includes('phantom'), 4000);
  await page.keyboard.press('i');
  await until('ult cast', () => window.__casts.includes('ult'), 4000);
  await page.screenshot({ path: output + '/04-unlocked-combat.png' });
  console.log('BROWSER positive casts PASS: owned U/I reach castSkill through real keys');

  assert.deepEqual(pageErrors, [], 'no uncaught page errors allowed: ' + pageErrors.join(' | '));
  console.log('BOT WAVE BROWSER INPUT-LOCK + STICKY J PASS (production game.html, real Chrome input)');
} finally {
  await browser.close();
}
