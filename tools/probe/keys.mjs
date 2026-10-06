// OWNER LAW (2026-10-07) — LIVE proof of the keyboard law for Local P2.
// The top-row Digit1/Digit2 pair must be INERT; the RIGHT-hand numpad pair
// (Numpad1/Numpad2) must cast P2 A1/A2. The honest readout is the rework
// combatant's own telemetry: a routed press changes `casts` when the ability
// executes, and `castFails` when it is legitimately refused (cc / condition).
// Both prove the KEY LAW; only a key that is not routed at all changes nothing.
import { open, wait, waitStage } from './lib.mjs';

async function toBattle(mode, p1, p2) {
  await page.click('#freeBattle');
  await waitStage(page, /screen-mode/);
  await page.click(`.modeCard[data-mode="${mode}"]`);
  await waitStage(page, /screen-fighter/, 20000);
  await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), p1);
  await wait(350);
  let lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(600); }
  if (p2) {
    await page.evaluate((h) => document.querySelector(`.rosterCard[data-hero="${h}"]`)?.click(), p2);
    await wait(350);
    lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
    if (/LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); await wait(600); }
  }
  lock = await page.evaluate(() => (document.getElementById('lockIn') || {}).innerText || '');
  if (/READY/i.test(lock) || /LOCK/i.test(lock)) { await page.evaluate(() => document.getElementById('lockIn')?.click()); }
  await page.waitForFunction(() => document.body.classList.contains('battle-hud-open'), { timeout: 120000, polling: 80 });
  await wait(3000);
}

// ONE readout: the rework's own per-side truth (no second authority invented).
const readSide = (page, idx) => page.evaluate((i) => {
  const HR = window.APEX_HERO_REWORK;
  const f = window.fighters && window.fighters[i];
  const ct = f && f.__hrCombatant ? f.__hrCombatant : null;
  const ctl = ct && ct.__ctl;
  const tel = ct && ct.telemetry ? ct.telemetry : null;
  return {
    name: f && f.name,
    isRework: !!(HR && ct),
    installed: !!(HR && HR.__localP2KeysInstalled),
    battleMode: (window.APEX_ARSENAL && window.APEX_ARSENAL.state || {}).battleMode || null,
    hp: f && f.hp,
    cc: !!(f && typeof f.hardCC === 'function' && f.hardCC()),
    casts: tel ? tel.casts : null,
    castFails: tel ? tel.castFails : null,
    bySkill: tel && tel.bySkill ? { ...tel.bySkill } : null,
    cd: ctl ? [0, 1].map((s) => Math.round((ctl.cooldownLeft ? ctl.cooldownLeft(s) : 0) * 100) / 100) : null,
  };
}, idx);

const diff = (a, b) => ({
  dCasts: (b.casts ?? 0) - (a.casts ?? 0),
  dFails: (b.castFails ?? 0) - (a.castFails ?? 0),
  dCd: [0, 1].map((i) => (b.cd && a.cd ? Math.round((b.cd[i] - a.cd[i]) * 100) / 100 : null)),
});

const VP = {
  desk: { width: 1280, height: 720 }, port: { width: 390, height: 844 },
  land: { width: 844, height: 390 }, phones: { width: 360, height: 780 },
};
const which = process.argv[2] || 'desk';
const { browser, page } = await open({ viewport: VP[which] || VP.desk });
await toBattle('local1v1', 'newbot', 'frost');

const rows = [];
const press = async (key) => {
  const before = await readSide(page, 1);
  await page.keyboard.press(key);
  await wait(800);
  const after = await readSide(page, 1);
  rows.push({ key, ...diff(before, after), cdAfter: after.cd, cc: after.cc, hp: Math.round(after.hp) });
};
const base = await readSide(page, 1);
console.log('P2 ' + JSON.stringify(base));
// The badge must NAME the accepted pair: a bare "1" reads as the number row.
const labels = await page.evaluate(() => {
  const out = {};
  for (const [k, id] of [['p1', 'p1Side'], ['p2', 'p2Side']]) {
    const side = document.getElementById(id);
    out[k] = [...side.querySelectorAll('.sk-key')].map((e) => {
      const b = e.getBoundingClientRect();
      // A badge must be at least as wide as the text it paints; a narrower box
      // is exactly what the clip-path cut ("NUM2" -> "UM 2").
      return {
        text: e.textContent,
        w: Math.round(b.width),
        need: Math.ceil(e.scrollWidth),
        clipped: e.scrollWidth > Math.ceil(b.width) + 1,
      };
    });
    const ctrl = side.querySelector('.id-ctrl');
    out[k + 'Ctrl'] = ctrl ? ctrl.textContent : null;
  }
  return out;
});
console.log('LABELS ' + JSON.stringify(labels));
await press('Digit1');
await press('Digit2');
await press('Numpad1');
await wait(1200);
await press('Numpad2');
for (const r of rows) console.log('KEY ' + JSON.stringify(r));
const routed = rows.filter((r) => r.dCasts > 0 || r.dFails > 0).map((r) => r.key);
console.log('ROUTED ' + JSON.stringify(routed));
console.log('BADGE_CLIPPED ' + JSON.stringify(
  Object.entries(labels).filter(([k]) => k === 'p1' || k === 'p2')
    .flatMap(([k, rows]) => rows.filter((r) => r.clipped).map((r) => k + ':' + r.text))));
console.log('VERDICT ' + JSON.stringify({
  topRowInert: rows.filter((r) => r.key.startsWith('Digit')).every((r) => r.dCasts === 0 && r.dFails === 0),
  numpadRouted: rows.filter((r) => r.key.startsWith('Numpad')).every((r) => r.dCasts > 0 || r.dFails > 0),
  p2KeysInstalled: base.installed,
  mode: base.battleMode,
}));
await browser.close();
