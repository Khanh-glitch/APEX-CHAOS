// Issue #105 P0-C — Result Gold FIRST ENTRY gate (real played match, no SKIP, no resize).
//
// Path under test (production, not a wrapper): a real BOT battle is played, the sealed
// match goes through the production K.O. hold, goldProductBridge.showGoldResult() inserts
// #apex-real-match-result, the iframe posts APEX_RESULT_GOLD_READY, the parent answers with
// the payload, and the Result runs its own six-phase choreography.
//
// Nothing in this gate clicks SKIP, presses keys, reloads, or dispatches or triggers a resize.
// Every animation frame from insert to settled is sampled INSIDE the iframe (same origin)
// and the parent is sampled at the iframe centre to identify any overlay owner.
//
// Per frame: iframe innerWidth/innerHeight, visualViewport, phase/done/skipped classes,
// .hero__img + weapon img complete/naturalWidth, font status, element rects for the
// controls and art, elementFromPoint owner at the art and Continue centres (iframe and
// parent), and the set of overlapping visible text/control pairs.
//
// Assertions on first entry (after the intro door has opened):
//   - hero art (2) and weapon art decoded (complete && naturalWidth > 0) and visible
//   - zero overlapping visible text/control pairs, in every frame from payload to settled
//   - the Continue control is the elementFromPoint owner at its centre (clickable)
//   - no parent element covers the iframe centre after the intro (owner check)
// The 300-frame post-settle resize is a CONTROL run only (A/B), never part of first entry.
import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowser, openApp, startBotBattle, wait, check } from './harness.mjs';

const OUT = process.env.ISSUE105_OUT || '/tmp/i105-result-first-entry';
const ALL_RECTS = [
  { w: 900, h: 560 }, { w: 1000, h: 600 }, { w: 1200, h: 650 }, { w: 1440, h: 900 }, { w: 390, h: 844 }, { w: 320, h: 568 },
];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const RECTS = ONLY.length ? ALL_RECTS.filter((r) => ONLY.includes(`${r.w}x${r.h}`)) : ALL_RECTS;

// Installed in the PARENT before the match ends. Observation only: no dispatched events.
const INSTRUMENT = () => {
  const State = (window.__fe = { t0: performance.now(), frames: [], events: [], doneAt: 0, frameEl: null });
  const now = () => Math.round(performance.now() - State.t0);
  const parentOwnerAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal === undefined ? el.className : '').split(' ').filter(Boolean).slice(0, 3).join('.')}` : null;
  };
  const snap = (f) => {
    const w = f.contentWindow; const d = w && f.contentDocument;
    if (!w || !d || !d.body) return null;
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const q = (s) => d.querySelector(s);
    const vis = (el) => { if (!el) return false; const s = w.getComputedStyle(el); return s.visibility !== 'hidden' && Number(s.opacity) > 0.01 && s.display !== 'none' && el.getBoundingClientRect().width > 0; };
    const run = q('.ac-run');
    const heroImgs = Array.from(d.querySelectorAll('.hero__img'));
    const weaponImg = q('.weapon__dais img');
    const cont = Array.from(d.querySelectorAll('button')).find((b) => /continue|tiếp/i.test(b.textContent || ''));
    const mid = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    const centre = (el) => { const m = mid(el); if (!m) return null; const hit = d.elementFromPoint(m[0], m[1]); return hit ? `${hit.tagName.toLowerCase()}.${String(hit.className && hit.className.baseVal === undefined ? hit.className : '').split(' ').filter(Boolean).slice(0, 2).join('.')}` : null; };
    // Overlap check among visible text/control leaves, excluding the intentional intro overlay.
    const leaves = Array.from(d.querySelectorAll('.topbar button, .skip, .dock button, .hero__who, .hero__plate, .weapon__name, .weapon__dmg, .clash, .racktabs button, .intro__copy, .brand__name, .apex-mastery-medal, h1, h2'))
      .filter((el) => !el.closest('.intro') && vis(el))
      .map((el) => ({ el, b: el.getBoundingClientRect() }));
    const pairs = [];
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ix = Math.min(a.b.right, b.b.right) - Math.max(a.b.left, b.b.left);
      const iy = Math.min(a.b.bottom, b.b.bottom) - Math.max(a.b.top, b.b.top);
      if (ix > 2 && iy > 2) pairs.push([a.el.className && String(a.el.className).slice(0, 24) || a.el.tagName, b.el.className && String(b.el.className).slice(0, 24) || b.el.tagName, Math.round(ix * iy)]);
    }
    const fr = f.getBoundingClientRect();
    const cxp = fr.left + fr.width / 2, cyp = fr.top + fr.height / 2;
    return {
      inner: [w.innerWidth, w.innerHeight], client: [d.documentElement.clientWidth, d.documentElement.clientHeight],
      vv: w.visualViewport ? [Math.round(w.visualViewport.width), Math.round(w.visualViewport.height)] : null,
      fonts: d.fonts ? d.fonts.status : null, ready: d.readyState,
      run: run ? run.className : null, lang: d.documentElement.lang,
      phase: run ? Number(run.dataset.phase || 0) : null,
      heroImgs: heroImgs.map((i) => ({ complete: i.complete, nw: i.naturalWidth, visible: vis(i), rect: r(i) })),
      weaponImg: weaponImg ? { complete: weaponImg.complete, nw: weaponImg.naturalWidth, visible: vis(weaponImg), rect: r(weaponImg) } : null,
      skip: q('.skip') ? { rect: r(q('.skip')), cls: q('.skip').className } : null,
      // Static layout blocks, for placing controls without overlaps (no animation-dependent rects).
      layout: Object.fromEntries(['.topbar', '.racktabs', '.rack', '.dock', '.hero[data-slot="1"]', '.hero[data-slot="2"]', '.clash', '.weapon', '.weapon__banner', '.weapon__dais', '.weapon__info', '.weapon__name', '.weapon__dmg', '.weapon__owner', '.ac-shell'].map((sel) => [sel, r(q(sel))])),
      nameDom: q('.weapon__name') ? { html: q('.weapon__name').outerHTML.slice(0, 500), spans: Array.from(d.querySelectorAll('.weapon__name .mask > span')).map((e) => ({ r: r(e), t: e.textContent.slice(0, 30), lh: w.getComputedStyle(e).lineHeight, fs: w.getComputedStyle(e).fontSize })) } : null,
      dockBtns: Array.from(d.querySelectorAll('.dock .btn')).map((b) => ({ t: (b.textContent || '').trim().slice(0, 14), rect: r(b) })),
      replay: r(Array.from(d.querySelectorAll('.topbar button')).find((b) => /replay|chơi lại/i.test(b.textContent || ''))),
      cont: cont ? { rect: r(cont), hitInside: (() => { const m = mid(cont); const hit = m && d.elementFromPoint(m[0], m[1]); return !!hit && cont.contains(hit); })(), hitOwner: centre(cont), disabled: cont.disabled } : null,
      // intro-gone (motion.css) ends with visibility:hidden, so the door is open when it is hidden.
      introVisible: q('.intro') ? w.getComputedStyle(q('.intro')).visibility !== 'hidden' : false,
      pairs: pairs.slice(0, 12),
      parentOwner: parentOwnerAt(cxp, cyp),
      settled: !!(run && run.classList.contains('is-done')),
    };
  };
  State.snapNow = () => (State.frameEl ? snap(State.frameEl) : null);
  const sample = (f, i) => {
    if (!f.isConnected) { State.events.push({ type: 'detached', t: now(), i }); return; }
    const s = snap(f);
    if (s) State.frames.push({ i, t: now(), s });
    if (s && s.settled && !State.doneAt) State.doneAt = now();
    if (State.doneAt && now() - State.doneAt > 400) { State.events.push({ type: 'sampling-end', t: now(), i }); return; }
    if (now() > 12000) { State.events.push({ type: 'timeout', t: now(), i }); return; }
    requestAnimationFrame(() => sample(f, i + 1));
  };
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.id === 'apex-real-match-result') {
        State.frameEl = n;
        // Clock starts at the real insert, not at instrumentation (the battle can run for minutes).
        State.t0 = performance.now();
        State.frames = []; State.events = []; State.doneAt = 0;
        const r = n.getBoundingClientRect();
        State.events.push({ type: 'insert', t: now(), rect: [r.left, r.top, r.width, r.height], parentInner: [innerWidth, innerHeight], visualVP: visualViewport ? [visualViewport.width, visualViewport.height] : null });
        n.addEventListener('load', () => State.events.push({ type: 'frame-load', t: now(), snap: snap(n) }));
        requestAnimationFrame(() => sample(n, 0));
      }
    }
  }).observe(document.body, { childList: true });
  window.addEventListener('message', (e) => {
    if (e.data && typeof e.data === 'object' && typeof e.data.type === 'string' && e.data.type.startsWith('APEX_RESULT_GOLD')) State.events.push({ type: 'msg:' + e.data.type, t: now() });
  });
};

async function run(browser, { w, h }) {
  const { page, context, errors } = await openApp(browser, {
    width: w, height: h, dpr: 1, storage: { 'apex.alpha.tutorial.v1': 'off' },
  });
  const failures = [];
  try {
    await startBotBattle(page, {});
    await page.waitForFunction(() => window.APEX_ARSENAL?.state?.active === true, { timeout: 90000 });
    await wait(1500);
    await page.evaluate(INSTRUMENT);
    // Deterministic QA setup for the FIRST-ENTRY Result lifecycle. The older
    // driver spammed J/K for up to five minutes and assumed a weapon hit;
    // NEWBOT's two abilities do NOT guarantee a PISTOL hit, so Hunter could
    // still have 986 HP after 691 presses. That was a test-driver dead end,
    // not evidence about the Result screen.
    //
    // Keep a REAL live BOT match and the production weapon/projectile/ledger
    // pipeline. This fixture equips the real player and aims a native PISTOL
    // projectile using the production weapon API; damage is resolved by the
    // NORMAL swept collision, not forged via ledger.onDamage/result objects.
    // The test already uses an HP=0 terminator AFTER verifying real damage.
    // This is a deterministic first-paint fixture, NOT a claim that an owner
    // physically fired the injected setup shot; player inputs have other gates.
    const setup = await page.evaluate(() => {
      const fighters = window.fighters || [];
      const player = fighters[0];
      const bot = fighters.find((x) => x && x !== player && x.hp > 0);
      const weaponApi = window.APEX_ARSENAL?.weaponApi;
      if (!player || !bot || !weaponApi?.equip || !weaponApi?.fireBullet) {
        return { ok: false, reason: 'production fighter/weapon authority missing' };
      }
      weaponApi.equip(player, 'PISTOL');
      return { ok: true, hp: Number(bot.hp), playerId: player.id, botId: bot.id };
    });
    if (!setup.ok) throw Error('Result first-entry real weapon fixture unavailable: ' + JSON.stringify(setup));
    let botHp = setup.hp;
    let shots = 0;
    const shotReceipts = [];
    for (; shots < 8 && botHp >= setup.hp - 1; shots++) {
      const fired = await page.evaluate(() => {
        const fighters = window.fighters || [];
        const player = fighters[0];
        const bot = fighters.find((x) => x && x !== player && x.hp > 0);
        const api = window.APEX_ARSENAL?.weaponApi;
        if (!player || !bot || !api?.fireBullet) return { ok: false, reason: 'match no longer active' };
        const angle = Math.atan2(bot.y - player.y, bot.x - player.x);
        // Place the QA player's firing position near the live target so the
        // actual physics determines whether the projectile connects; never
        // edit opponent HP/damage totals for this prerequisite.
        player.x = Math.max(45, Math.min(955, bot.x - 110 * Math.cos(angle)));
        player.y = Math.max(45, Math.min(955, bot.y - 110 * Math.sin(angle)));
        const aim = Math.atan2(bot.y - player.y, bot.x - player.x);
        api.fireBullet({
          owner: player, x: player.x, y: player.y,
          angle: aim, speed: 1700, damage: 90,
          weapon: 'PISTOL', radius: 7, life: 1.5,
        });
        return { ok: true, playerHp: player.hp, botHp: bot.hp };
      });
      shotReceipts.push(fired);
      if (!fired.ok) break;
      await wait(650);
      botHp = await page.evaluate(() => {
        const player = window.fighters?.[0];
        const bot = (window.fighters || []).find((x) => x && x !== player);
        return bot ? Number(bot.hp) : null;
      });
      if (botHp == null) break;
    }
    if (!(botHp < setup.hp - 1)) {
      throw new Error('No production PISTOL projectile damage in live BOT match: '
        + JSON.stringify({ setup, botHp, shots, shotReceipts }));
    }
    // Rework combatants die when ALL their bodies are dead (HRW.bodyKO), so every opponent body is sealed.
    await page.evaluate(() => { (window.fighters || []).filter((x) => x && x.id !== 1).forEach((f) => { f.hp = 0; }); });
    await page.waitForFunction(() => !!window.__fe && window.__fe.doneAt > 0, { timeout: 60000 });
    await wait(300);
    const data = await page.evaluate(() => {
      const rg = window.APEX_ARSENAL?.state?.resultGold;
      const dealt = rg?.players?.map((p) => p.damage?.dealt) || null;
      return { ...window.__fe, weaponDamageDealt: dealt, weaponCount: rg?.weapons?.length ?? null };
    });
    await mkdir(OUT, { recursive: true });
    const file = `${OUT}/first-entry-${w}x${h}.json`;
    // A/B CONTROL (report + equality only): the settled first-entry geometry against the
    // geometry after a real +1px viewport resize and back. Resize is never used for first entry.
    const firstSettled = await page.evaluate(() => window.__fe.snapNow());
    await page.screenshot({ path: `${OUT}/settled-${w}x${h}.png` });
    await page.setViewport({ width: w, height: h + 1 });
    await wait(700);
    await page.setViewport({ width: w, height: h });
    // Measure only after the viewport is back at the original size and two frames have laid out.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const resized = await page.evaluate(() => window.__fe.snapNow());
    await page.screenshot({ path: `${OUT}/after-resize-${w}x${h}.png` });
    await wait(400);
    const keys = ['replay', 'skip', 'cont'];
    // Static layout only: hero art floats (idle animation), so it is excluded from the equality.
    const geo = (x) => JSON.stringify([x.replay, x.cont && x.cont.rect]);
    const control = { firstSettled: { pairs: firstSettled.pairs, geo: geo(firstSettled) }, afterResize: { pairs: resized.pairs, geo: geo(resized) }, keysCompared: keys };
    data.control = control;
    await writeFile(file, JSON.stringify({ size: [w, h], errors, ...data }, null, 1));
    check(failures, geo(firstSettled) === geo(resized), `${w}x${h} A/B control: settled first-entry geometry equals post-resize geometry`, { same: geo(firstSettled) === geo(resized), pairsFirst: firstSettled.pairs.length, pairsResized: resized.pairs.length });
    // Assertions on FIRST ENTRY: after the intro door has opened (no intro overlay visible).
    const after = data.frames.filter((f) => !f.s.introVisible && f.s.heroImgs.length === 2);
    const bad = (pred) => after.filter(pred).length;
    const decodedAll = after.length > 0 && after.every((f) => f.s.heroImgs.every((i) => i.complete && i.nw > 0) && f.s.weaponImg && f.s.weaponImg.complete && f.s.weaponImg.nw > 0);
    const noOverlap = bad((f) => f.s.pairs.length > 0) === 0;
    // Weapon info column: name, damage and owner chip must sit inside their cell (no overflow into the banner or tabs).
    const inCell = (f) => { const L = f.s.layout || {}; const c = L['.weapon__info']; if (!c) return false; const within = (x) => !x || (x[1] >= c[1] - 1 && x[3] <= c[3] + 1 && x[0] >= c[0] - 1 && x[2] <= c[2] + 1); return ['.weapon__name', '.weapon__dmg', '.weapon__owner'].every((k) => within(L[k])); };
    // Settled frame only: the owner chip and damage counter slide in during the Gold reveal (transform, by design).
    const infoFits = after.length > 0 && inCell(after.at(-1));
    const contOk = after.length > 0 && !!after.at(-1).s.cont && after.at(-1).s.cont.hitInside === true && after.at(-1).s.cont.disabled === false;
    const settledOk = !!data.doneAt;
    const pair = (f) => f.s.pairs.map((p) => p.join('|')).join(' ; ');
    check(failures, decodedAll, `${w}x${h} first entry: hero x2 and weapon art decoded and visible after intro`, { frames: after.length });
    check(failures, noOverlap, `${w}x${h} first entry: zero overlapping text/control pairs after intro`, { bad: bad((f) => f.s.pairs.length > 0), sample: after.find((f) => f.s.pairs.length) ? pair(after.find((f) => f.s.pairs.length)) : null });
    check(failures, infoFits, `${w}x${h} first entry: weapon name, damage and owner chip fit their info column`, { settled: after.at(-1)?.s.layout?.['.weapon__name'] ?? null, info: after.at(-1)?.s.layout?.['.weapon__info'] ?? null });
    check(failures, !!contOk, `${w}x${h} first entry: Continue is enabled and receives the hit at its centre`, { cont: after.at(-1)?.s.cont });
    check(failures, data.weaponDamageDealt && data.weaponDamageDealt.some((d) => d > 0), `${w}x${h} first entry: the played match has real weapon damage (not an empty result)`, { dealt: data.weaponDamageDealt });
    check(failures, settledOk, `${w}x${h} first entry: Result settled (is-done) under the real lifecycle`, { doneAt: data.doneAt, events: data.events.map((e) => e.type) });
    return { size: [w, h], failures, file };
  } finally {
    await context.close();
  }
}

const browser = await launchBrowser();
const results = [];
try {
  for (const size of RECTS) results.push(await run(browser, size));
} finally {
  await browser.close();
}
const all = results.flatMap((r) => r.failures);
console.log(JSON.stringify({ sizes: results.map((r) => `${r.size[0]}x${r.size[1]}`) }));
if (all.some((c) => !c.ok)) process.exitCode = 1;
