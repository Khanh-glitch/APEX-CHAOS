// Issue #105 owner rejection R2, P0-B: roster ownership and P1/P2 pick rules.
// Real Chromium, the real Gold Fighter Pick route (Bot Battle and Local 1v1).
//   · Fresh Guest owns ROBOT (NEWBOT) and HUNTER, keeps 350 AC, and the Lucky pool is the
//     six unowned playable fighters.
//   · BOT P2 opens on HUNTER; P1 HUNTER auto-selects BOT ROBOT (never a mirror).
//   · BOT P1 ROBOT vs HUNTER reaches the battle with exactly those two fighters.
//   · Switching P1 keeps the BOT choice and re-derives the CPU slot.
//   · Local P2 never opens on P1's fighter; P1's fighter is visibly TAKEN; Local locks differ.
//   · Reload keeps the roster; an old save gains HUNTER once (additive, idempotent) and keeps
//     credits, progression and claimed matches.
// Screenshots are written as Pick-pair evidence. Nothing here grants ownership or AC.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, openApp, wait, check } from './harness.mjs';

const OUT = process.env.ROSTER_OUT || path.join(process.env.ISSUE105_OUT || '/tmp/issue105-browser', 'roster-pairs');
const META_KEY = 'apexChaos.arsenalMeta.v1';
const results = [];
const receipts = {};
const browser = await launchBrowser();

const sorted = (xs) => [...xs].sort();
const meta = (page) => page.evaluate(() => {
  const st = window.APEX_ARSENAL_META.getState();
  return { credits: st.credits, owned: [...st.ownedFighters], migrations: st.rosterMigrations || {}, claimed: st.claimedMatchIds || [], botMatches: st.progression?.botMatches, poolLocked: ['ROBOT','HUNTER','CRYSTAL','MAGNET','ICE','MIRROR','BOXE','SHURI'].filter((n) => !st.ownedFighters.includes(n)) };
});

async function goFighter(page, mode) {
  await page.click('#freeBattle');
  await page.waitForFunction(() => document.querySelector('#modeSelectScreen')?.getAttribute('aria-hidden') === 'false', { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => document.body.dataset.apexSceneTransition === 'DONE', { timeout: 120000 }).catch(() => {});
  await wait(900);
  await page.click(`.modeCard[data-mode="${mode}"]`);
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('screen-fighter') && document.body.dataset.apexSceneTransition === 'DONE', { timeout: 60000 });
  await wait(900);
}
const clickHero = (page, id) => page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), id);
const slots = (page) => page.evaluate(() => ({
  // The BOT CPU's fighter is the BOT panel's name (it is shown before P1 locks too).
  p2Name: document.querySelector('#p2Name')?.textContent.trim() || '',
  p2: document.querySelector('.rosterCard.p2-selected')?.dataset.hero || null,
  p1: document.querySelector('.rosterCard.p1-selected')?.dataset.hero || null,
  taken: [...document.querySelectorAll('.rosterCard.is-taken')].map((c) => c.dataset.hero),
  p1Locked: document.querySelector('#stage')?.classList.contains('fighter-p1-locked') === true,
}));
async function lockAndWaitBattle(page) {
  await page.click('#lockIn');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('fighter-p1-locked') || !!document.querySelector('#battleHudHost.is-open'), { timeout: 30000 }).catch(() => {});
  if (!(await page.$('#battleHudHost.is-open #p1Side .skill[data-i="0"]'))) await page.click('#lockIn').catch(() => {});
  await page.waitForSelector('#battleHudHost.is-open #p1Side .skill[data-i="0"]', { timeout: 90000 });
  await wait(1200);
  return page.evaluate(() => (window.fighters || []).map((f) => String(f.name || '').toUpperCase()));
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

try {
  // ── S0 fresh Guest: ownership, economy, pool, BOT default ──────────────────────
  {
    const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    const m0 = await meta(page);
    receipts.fresh = m0;
    check(results, sorted(m0.owned).join() === 'HUNTER,ROBOT', 'fresh Guest owns exactly ROBOT and HUNTER', { owned: m0.owned });
    check(results, m0.credits === 350, 'fresh Guest keeps 350 AC', { credits: m0.credits });
    check(results, m0.poolLocked.length === 6 && !m0.poolLocked.includes('HUNTER') && !m0.poolLocked.includes('ROBOT'), 'Lucky pool is the six unowned playable fighters (no owned fighter)', { pool: m0.poolLocked });
    const botDefault = await page.evaluate(() => window.APEX_GOLD.botOpponentProductionId());
    check(results, botDefault === 'HUNTER', 'BOT CPU default is HUNTER', { botDefault });
    const resolved = await page.evaluate(() => ({ vsRobot: window.APEX_GOLD.botOpponentProductionIdFor('ROBOT'), vsHunter: window.APEX_GOLD.botOpponentProductionIdFor('HUNTER') }));
    check(results, resolved.vsRobot === 'HUNTER' && resolved.vsHunter === 'ROBOT', 'P1 HUNTER resolves BOT to ROBOT; P1 ROBOT keeps BOT HUNTER', resolved);
    check(results, errors.length === 0, 'fresh Guest: no uncaught page errors', { errors: errors.slice(0, 3) });
    await context.close();
  }

  // ── S1 BOT P1 ROBOT vs HUNTER ──────────────────────────────────────────────────
  {
    const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await goFighter(page, 'bot');
    const s0 = await slots(page);
    await page.waitForFunction(() => document.querySelector('.rosterCard[data-hero="hunter"]'), { timeout: 60000 });
    await lockAndWaitP1(page);
    const s1 = await slots(page);
    await shot(page, 'bot-p1-robot-vs-p2-hunter-pick');
    check(results, s1.p2 === 'hunter', 'BOT P1 ROBOT: CPU slot shows HUNTER', { s1 });
    const battle = await lockAndWaitBattle(page);
    receipts.botRobotVsHunter = { battle, s1 };
    check(results, sorted(battle).join() === 'HUNTER,ROBOT' && battle.length === 2, 'BOT P1 ROBOT vs HUNTER battle has ROBOT and HUNTER', { battle });
    check(results, errors.length === 0, 'BOT P1 ROBOT: no uncaught page errors', { errors: errors.slice(0, 3) });
    await context.close();
  }

  // ── S2 BOT P1 HUNTER -> CPU ROBOT, then switch P1 and re-enter ─────────────────
  {
    const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await goFighter(page, 'bot');
    await clickHero(page, 'hunter');
    await wait(500);
    const names = await page.evaluate(() => ({
      hunter: document.querySelector('.rosterCard[data-hero="hunter"] .rosterName')?.textContent.trim() || '',
      newbot: document.querySelector('.rosterCard[data-hero="newbot"] .rosterName')?.textContent.trim() || '',
    }));
    const sHunter = await slots(page);
    check(results, sHunter.p1 === 'hunter' && sHunter.p2Name === names.newbot && names.newbot !== names.hunter, 'BOT P1 HUNTER: CPU panel auto-selects ROBOT', { sHunter, names });
    check(results, sHunter.taken.includes('hunter') === false, 'BOT P1 HUNTER: P1 fighter is not marked taken before P1 locks', { taken: sHunter.taken });
    await lockAndWaitP1(page);
    const sLocked = await slots(page);
    check(results, sLocked.p2 === 'newbot' && sLocked.taken.includes('hunter'), 'BOT slot after P1 lock: ROBOT chosen, HUNTER visibly taken', { sLocked });
    await shot(page, 'bot-p1-hunter-vs-p2-robot-pick');
    // Switch: back to ROBOT for P1 is a locked-in step, so verify the switch BEFORE lock on a fresh pick.
    const battle = await lockAndWaitBattle(page);
    receipts.botHunterVsRobot = { battle, sLocked };
    check(results, sorted(battle).join() === 'HUNTER,ROBOT' && battle.length === 2, 'BOT P1 HUNTER vs ROBOT battle has HUNTER and ROBOT', { battle });
    check(results, errors.length === 0, 'BOT P1 HUNTER: no uncaught page errors', { errors: errors.slice(0, 3) });
    await context.close();
  }
  {
    // Switch before lock and re-entry: BOT choice survives a P1 change and the CPU follows P1.
    const { page, context } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await goFighter(page, 'bot');
    await clickHero(page, 'hunter');
    await wait(300);
    const a = await slots(page);
    await clickHero(page, 'newbot');
    await wait(300);
    const b = await slots(page);
    const sw = await page.evaluate(() => ({
      hunter: document.querySelector('.rosterCard[data-hero="hunter"] .rosterName')?.textContent.trim() || '',
    }));
    check(results, a.p2Name !== sw.hunter && b.p2Name === sw.hunter, 'BOT switch: P1 HUNTER -> ROBOT returns the CPU to HUNTER', { a, b, hunter: sw.hunter });
    await context.close();
  }

  // ── S3 Local 1v1: distinct picks, visible TAKEN, equal pick refused ────────────
  {
    const { page, context, errors } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    await goFighter(page, 'local1v1');
    await page.click('#lockIn');
    await wait(700);
    const p2a = await slots(page);
    check(results, p2a.p2 === 'hunter' && p2a.p1 === 'newbot', 'Local P2 opens on HUNTER (P1 is ROBOT)', { p2a });
    check(results, p2a.taken.includes('newbot'), 'Local P2: P1 fighter ROBOT is visibly TAKEN', { taken: p2a.taken });
    await clickHero(page, 'newbot');
    await wait(400);
    const p2b = await slots(page);
    check(results, p2b.p2 === 'hunter', 'Local P2 tap on P1 fighter is refused (P2 stays HUNTER)', { p2b });
    await shot(page, 'local-p1-robot-p2-hunter-pick');
    const battle = await lockAndWaitBattle(page);
    receipts.local = { battle };
    check(results, sorted(battle).join() === 'HUNTER,ROBOT' && battle.length === 2, 'Local ROBOT vs HUNTER battle uses two different fighters', { battle });
    check(results, errors.length === 0, 'Local 1v1: no uncaught page errors', { errors: errors.slice(0, 3) });
    await context.close();
  }

  // ── S4 reload keeps the roster; old save migrates HUNTER once ──────────────────
  {
    const { page, context } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', storage: { 'apex.alpha.tutorial.v1': 'off' } });
    const before = await meta(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 }).catch(() => {});
    await wait(800);
    const after = await meta(page);
    receipts.reload = { before: before.owned, after: after.owned };
    check(results, sorted(after.owned).join() === 'HUNTER,ROBOT' && after.credits === 350, 'reload keeps ROBOT+HUNTER and 350 AC', { before: before.owned, after: after.owned, credits: after.credits });
    await context.close();
  }
  {
    const legacy = {
      version: 1, credits: 1234, ownedFighters: ['ROBOT'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT',
      totalSpins: 2, unlockedAt: { ROBOT: 0 }, claimedMatchIds: ['legacy-match-1'],
      progression: { botMatches: 3, botWins: 1, localMatches: 0, claimedIds: [] },
    };
    const { page, context } = await openApp(browser, { width: 1440, height: 900, lang: 'eng', seed: legacy, storage: { 'apex.alpha.tutorial.v1': 'off' } });
    const m1 = await meta(page);
    receipts.migration = m1;
    check(results, sorted(m1.owned).join() === 'HUNTER,ROBOT', 'old save gains HUNTER (additive)', { owned: m1.owned });
    check(results, m1.credits === 1234 && m1.botMatches === 3 && m1.claimed.join() === 'legacy-match-1', 'old save keeps AC, progression and claimed matches', { credits: m1.credits, botMatches: m1.botMatches, claimed: m1.claimed });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 }).catch(() => {});
    await wait(800);
    const m2 = await meta(page);
    check(results, m2.owned.length === 2 && m2.owned.filter((n) => n === 'HUNTER').length === 1 && m2.credits === 1234, 'migration is idempotent across reload (one HUNTER, same AC)', { owned: m2.owned, credits: m2.credits });
    await context.close();
  }
} finally {
  await browser.close();
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'roster-pairs.json'), JSON.stringify({ results, receipts }, null, 2));
}
const failed = results.filter((r) => !r.ok);
console.log('SUMMARY', JSON.stringify({ total: results.length, failed: failed.map((r) => r.name) }));
if (failed.length) process.exitCode = 1;

// One helper used above: picks P1 (ROBOT or HUNTER already selected) and locks it.
async function lockAndWaitP1(page) {
  await page.click('#lockIn');
  await page.waitForFunction(() => document.querySelector('#stage')?.classList.contains('fighter-p1-locked'), { timeout: 30000 }).catch(() => {});
  await wait(500);
}
