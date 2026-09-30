#!/usr/bin/env node
// FROST V1 — Level-1 implementation gates (F00–F15).
// Authority: docs/hero-rework/frost-v1/00_FROST_IMPLEMENTATION_AUTHORITY.md
// Matrix:    docs/hero-rework/frost-v1/03_IMPLEMENTATION_TEST_MATRIX.md
//
// Boots the REAL engine + runtimes headless (shared crystalaHarness) and
// proves Frost law slice by slice. Gates are added as slices land; every
// gate below must pass on the final SHA.
//
// Usage: node tools/testFrostV1Gates.mjs
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

const fatalLoad = (H.loadErrors || []).filter((e) => /arsenal|hero-rework|apexEngine|iceVisual/.test(String(e.file)));
gate('F00-boot', fatalLoad.length === 0, fatalLoad.length ? fatalLoad.slice(0, 3) : 'runtimes ready');

const REG = win.APEX_HERO_REWORK_REGISTRY;
const HR = win.APEX_HERO_REWORK;
const SHELLS = win.APEX_ARSENAL_SHELLS;

/* F00 — identity/alias/display layer (Slice A) */
try {
  const keys = Object.keys(REG.HEROES);
  gate('F00-single-definition',
    keys.length === 12 && keys[5] === 'ICE' && !keys.includes('FROST') && REG.HEROES.ICE.id === 'ICE',
    { count: keys.length, ice: REG.HEROES.ICE.id, hasFrostKey: keys.includes('FROST') });
} catch (e) { gate('F00-single-definition', false, String(e && e.message)); }

try {
  gate('F00-alias-resolution',
    REG.resolveHeroId('FROST') === 'ICE'
    && REG.resolveHeroId('ICE') === 'ICE'
    && REG.resolveHeroId('ROBOT') === 'ROBOT'
    && REG.displayNameFor('ICE') === 'FROST'
    && REG.displayNameFor('FROST') === 'FROST'
    && REG.displayNameFor('ROBOT') === 'ROBOT',
    {
      frost: REG.resolveHeroId('FROST'), ice: REG.resolveHeroId('ICE'),
      dispIce: REG.displayNameFor('ICE'), dispRobot: REG.displayNameFor('ROBOT'),
    });
} catch (e) { gate('F00-alias-resolution', false, String(e && e.message)); }

try {
  const v = REG.validateRegistry();
  gate('F00-registry-valid', v.ok && v.heroCount === 12 && v.skillCount === 36, { errors: v.errors });
} catch (e) { gate('F00-registry-valid', false, String(e && e.message)); }

try {
  const viaFrost = SHELLS.typeFor('FROST');
  const viaIce = SHELLS.typeFor('ICE');
  gate('F00-shell-alias',
    !!viaFrost && !!viaIce && viaFrost === viaIce
    && viaFrost.name === 'ICE' && viaFrost.__hrHero === 'ICE' && viaFrost.compatKit === 'REWORK'
    && SHELLS.ids.includes('ICE') && !SHELLS.ids.includes('FROST'),
    { name: viaFrost && viaFrost.name, hrHero: viaFrost && viaFrost.__hrHero, same: viaFrost === viaIce });
} catch (e) { gate('F00-shell-alias', false, String(e && e.message)); }

try {
  // Display: shell product copy, skill HUD, battle HUD names show FROST.
  const shell = SHELLS.typeFor('ICE');
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const [a] = H.fighters();
  const hud = HR.skillHud(a);
  const p1name = win.document.getElementById('p1-name').innerText;
  // Storage truth untouched: body/shell/combatant/save keys stay ICE.
  const ct = HR.byCombatant(a);
  gate('F00-display-frost',
    /FROST/.test(shell.desc) && hud.length === 2 && hud[0].startsWith('J · FROST.a1') && p1name === 'FROST'
    && a.name === 'ICE' && ct.heroId === 'ICE',
    { desc: shell.desc, hud, p1name, body: a.name, heroId: ct.heroId });
} catch (e) { gate('F00-display-frost', false, String(e && e.message)); }

try {
  // Display: shop grid/detail, quest map, pick grid show FROST (storage ids stay).
  const META = win.APEX_ARSENAL_META;
  META.paintShop('ICE');
  const cardName = win.document.querySelector('[data-shop-card="ICE"] .aq-fighter-name');
  const detailH2 = win.document.querySelector('#aq-shop-detail h2');
  const shopOk = !!cardName && cardName.textContent === 'FROST'
    && !!detailH2 && detailH2.textContent === 'FROST'
    && cardName.closest('[data-shop-card]').getAttribute('data-shop-card') === 'ICE';
  win.beginArsenalQuestMap();
  const stage4 = [...win.document.querySelectorAll('#aq-quest-map .aq-stage-name')][3];
  const mapOk = !!stage4 && stage4.textContent === 'FROST';
  // Pick-grid patch mechanism on synthetic roster DOM (the live roster grid
  // renders 0 cards headless — engine wrapper chain needs browser boot;
  // real-grid proof moves to browser slice F14).
  const synth = win.document.createElement('div');
  synth.innerHTML = '<span class="aq-fighter-name">ICE</span><div id="roster-grid"><div class="f-name">ICE</div></div>'
    + '<span class="aq-fighter-name">ROBOT</span><span class="aq-stage-name">SERVICE</span><div class="f-name">ICE</div>';
  win.document.body.appendChild(synth);
  const patched = HR.patchFrostProductCopy(synth);
  const synthNames = [...synth.querySelectorAll('.aq-fighter-name,.f-name,.aq-stage-name')].map((el) => el.textContent);
  const patchOk = patched === 2 && synthNames.join('|') === 'FROST|FROST|ROBOT|SERVICE|ICE';
  synth.remove();
  gate('F00-display-shop-map-pick', shopOk && mapOk && patchOk,
    { card: cardName && cardName.textContent, detail: detailH2 && detailH2.textContent, stage4: stage4 && stage4.textContent, patchOk });
} catch (e) { gate('F00-display-shop-map-pick', false, String(e && e.message)); }

try {
  // Alias match entry: 'FROST' starts the same canonical ICE rework match.
  T.start('FROST', 'ROBOT');
  T.holdSpawns();
  const [a] = H.fighters();
  const ct = HR.byCombatant(a);
  gate('F00-alias-match-entry',
    a.name === 'ICE' && HR.isReworkFighter(a) && !!ct && ct.heroId === 'ICE',
    { body: a.name, heroId: ct && ct.heroId });
} catch (e) { gate('F00-alias-match-entry', false, String(e && e.message)); }

try {
  // Slice A behavior preservation: legacy ICE kit still casts (flip is Slice B).
  T.start('ICE', 'ROBOT');
  T.holdSpawns();
  const [a] = H.fighters();
  const ct = HR.byCombatant(a);
  const ctl = HR.abilityController(ct);
  win.APEX_ARSENAL_SKILL_GATE.pressJ(a);
  T.step(10 / 60);
  gate('F00-behavior-preserved',
    ct.telemetry.casts >= 1 && ctl.cooldownLeft('A1') > 0,
    { casts: ct.telemetry.casts, cd: +ctl.cooldownLeft('A1').toFixed(2) });
} catch (e) { gate('F00-behavior-preserved', false, String(e && e.message)); }

win.exitArsenalQuestMode?.();

console.log(`\n[FROST V1 GATES] ${Object.values(report.gates).filter((g) => g.pass).length}/${Object.keys(report.gates).length} gates passed`);
if (report.failures.length) console.log('FAILURES:', report.failures.join(', '));
process.exit(report.failures.length ? 1 : 0);
