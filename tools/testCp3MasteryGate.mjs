// CP3 mastery contract gate.
// Executes the REAL owner catalog, result ledger, wallet and cosmetic
// authority. It proves that live feedback is monotonic-only, sealed folding
// is idempotent behind claimedMatchIds, BOT/LOCAL side scope is correct,
// RPG-7 uses strict >1000 lifetime damage, ECOBOT requires 42/42 NEWBOT
// achievements, and locked skins preserve—but do not render—old loadouts.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const WALLET_KEY = 'apexChaos.arsenalMeta.v1';
const CORE_SIX = ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'];
const FINAL_ONLY = [
  'executioner', 'glass-cannon', 'sure-shot', 'assassin', 'final-round',
  'last-stand', 'untouchable', 'one-breath', 'comeback', 'kiter', 'clutch',
  'speed-win', 'fate-hand',
];

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    _map: map,
  };
}

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

// ── real result ledger: live-safe vs final-only classification ─────────────
function bootLedgerScope() {
  const context = { window: {}, console };
  context.globalThis = context.window;
  vm.createContext(context);
  for (const rel of [
    'public/game/arsenal/arsenalCWeaponSet.generated.js',
    'public/game/results/ownerAwards.generated.js',
    'public/game/results/matchResultAuthority.js',
  ]) {
    vm.runInContext(read(rel), context, { filename: rel, timeout: 7000 });
  }
  return context.window;
}

const ledgerScope = bootLedgerScope();
assert.equal(ledgerScope.APEX_RESULT_OWNER_CATALOG.length, 47);
const weaponConfig = {
  WEAPONS: { RPG_7: { family: 'SEMI' }, PISTOL: { family: 'SEMI' } },
  tierOf: () => 'T1',
};
function makeLedger(p1Name = 'ROBOT', p2Name = 'ROBOT', mode = 'LOCAL') {
  const f1 = { id: 1, name: p1Name, x: 200, y: 500, hp: 1000, maxHp: 1000 };
  const f2 = { id: 2, name: p2Name, x: 800, y: 500, hp: 1000, maxHp: 1000 };
  const ledger = ledgerScope.APEX_MATCH_RESULT_AUTHORITY.create({
    actors: [f1, f2], mode, weaponConfig, startedAt: 10000,
  });
  return { f1, f2, ledger };
}

{
  const { f1, f2, ledger } = makeLedger();
  ledger.onShot(f1, 'RPG_7');
  f2.hp = 700;
  ledger.onDamage(f2, f1, 'arsenal-rpg-7', 300, false, { x: 700, y: 500 });
  const live = ledger.evaluateLive();
  const liveIds = live.filter((event) => event.sideIndex === 0).map((event) => event.achievementId);
  assert.ok(liveIds.includes('first-blood'), 'latched first-blood is live-safe');
  assert.ok(liveIds.includes('overkill'), 'max-hit overkill is live-safe');
  assert.ok(!live.some((event) => FINAL_ONLY.includes(event.achievementId)), 'no final-only award may be announced live');
  assert.equal(ledger.evaluateLive().length, 0, 'a live award is announced once per track');

  const sealed = ledger.seal('P1');
  assert.equal(Object.keys(sealed.players[0].achievementBests).length, 42, 'NEWBOT has exactly 42 applicable achievements');
  assert.equal(sealed.players[0].achievementBests['first-blood'].value, 1);
  assert.equal(sealed.players[0].achievementBests.overkill.value, 300);
  assert.equal(sealed.players[0].damage.sources.find((s) => s.weaponId === 'RPG_7').damage, 300);
  assert.equal(ledger.evaluateLive().length, 0, 'a sealed ledger cannot emit live unlocks');
}

{
  const { f1, f2, ledger } = makeLedger();
  f2.hp = 199;
  ledger.onDamage(f2, f1, 'arsenal-pistol', 801);
  f2.hp = 0;
  ledger.onDamage(f2, f1, 'arsenal-pistol', 199);
  const liveIds = ledger.evaluateLive().map((event) => event.achievementId);
  assert.ok(!liveIds.includes('executioner'), 'kill-moment executioner stays seal-only');
  assert.ok(!liveIds.includes('final-round'), 'kill-moment final-round stays seal-only');
  const sealed = ledger.seal('P1');
  assert.ok(sealed.players[0].awards.some((award) => award.achievementId === 'executioner'));
}

// ── real wallet: one mastery state, no new AC authority ────────────────────
const catalogSource = read('public/game/results/ownerAwards.generated.js');
const metaSource = read('public/game/arsenal/arsenalMetaRuntime.js');

function bootMeta(initial = {}, extraWindow = {}) {
  const storage = makeStorage(initial);
  const events = [];
  const window = {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(event) { events.push(event); return true; },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    console,
    CustomEvent: FakeCustomEvent,
    APEX_PRODUCT_SURFACE: {
      roster: { visibleIds: [...CORE_SIX, 'SLIME'], playableIds: CORE_SIX },
      canLaunch: () => true,
    },
    ...extraWindow,
  };
  const context = {
    window, console, localStorage: storage, setTimeout, clearTimeout,
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean,
    RegExp, Error, Set, Map, CustomEvent: FakeCustomEvent,
  };
  vm.createContext(context);
  vm.runInContext(catalogSource, context, { filename: 'ownerAwards.generated.js' });
  vm.runInContext(`(function(){ with (window) {\n${metaSource}\n} })();`, context, {
    filename: 'arsenalMetaRuntime.js',
  });
  return { meta: window.APEX_ARSENAL_META, storage, window, events };
}

const award = (achievementId, value = 1, observedParams = {}) => ({ achievementId, value, observedParams });
const player = (heroId, { awards = [], bests = {}, sources = [] } = {}) => ({
  character: { heroId },
  awards,
  achievementBests: bests,
  damage: { sources },
});
const rpg = (damage) => ({ kind: 'weapon', weaponId: 'RPG_7', damage });
const sealedState = (mode, id, players, extra = {}) => ({
  battleMode: mode,
  resultGold: { meta: { id }, players },
  ...extra,
});

{
  const { meta, events } = bootMeta();
  assert.equal(meta.credits(), 350);
  assert.deepEqual(meta.getMastery(), {
    earned: {}, best: {}, weaponDamage: {}, recent: [], unseenSkinUnlocks: [],
  });
  assert.equal(meta.heroMasteryProgress('ROBOT').total, 42);
  assert.equal(meta.heroMasteryProgress('NEWBOT').total, 42);

  const live = meta.recordMasteryUnlocks([{ heroId: 'ROBOT', achievementId: 'first-blood', value: 1 }]);
  assert.equal(live.ok, true);
  assert.equal(live.unlocks.length, 1);
  assert.equal(live.unlocks[0].heroId, 'NEWBOT', 'engine ROBOT maps to result NEWBOT exactly once');
  assert.equal(events.filter((event) => event.type === 'apex:mastery-unlocked').length, 1);
  const duplicate = meta.recordMasteryUnlocks([{ heroId: 'NEWBOT', achievementId: 'first-blood', value: 1 }]);
  assert.equal(duplicate.unlocks.length, 0, 'first-lifetime earn is never re-announced');
  assert.equal(meta.getMastery().recent.length, 1);
  assert.equal(meta.recordMasteryUnlocks([{ heroId: 'NEWBOT', achievementId: 'signature-hunter', value: 1 }]).unlocks.length, 0,
    'another hero signature cannot be folded into NEWBOT mastery');

  const botResult = sealedState('BOT', 'cp3-bot-1', [
    player('NEWBOT', {
      awards: [award('overkill', 300, { hit: 300 })],
      bests: {
        'first-blood': { value: 1, observedParams: {} },
        overkill: { value: 300, observedParams: { hit: 300 } },
      },
      sources: [rpg(600), { kind: 'skill', weaponId: 'RPG_7', damage: 9999 }],
    }),
    player('HUNTER', {
      awards: [award('first-blood')],
      sources: [rpg(2000)],
    }),
  ]);
  const paid = meta.awardBattleResult('P1', botResult);
  assert.equal(paid.ok, true);
  assert.equal(paid.amount, 200);
  assert.equal(meta.credits(), 550, 'CP3 does not change BOT win AC');
  assert.equal(paid.mastery.unlocks.length, 1);
  assert.equal(paid.mastery.unlocks[0].achievementId, 'overkill');
  assert.equal(meta.getMastery().weaponDamage.RPG_7, 600, 'BOT folds P1 actual weapon damage only');
  assert.equal(meta.heroMasteryProgress('HUNTER').earned, 0, 'BOT opponent achievements never enter the device profile');
  assert.equal(meta.awardBattleResult('P1', botResult).ok, false, 'same in-memory battle state cannot be paid twice');
  const duplicateFreshState = sealedState('BOT', 'cp3-bot-1', botResult.resultGold.players);
  assert.equal(meta.awardBattleResult('P1', duplicateFreshState).reason, 'duplicate-claim');
  assert.equal(meta.getMastery().weaponDamage.RPG_7, 600, 'duplicate sealed callbacks cannot re-fold RPG damage');

  const localOne = sealedState('LOCAL', 'cp3-local-1', [
    player('HUNTER'),
    player('NEWBOT', { awards: [award('steady-hand', 5)], sources: [rpg(400)] }),
  ]);
  const localPaid = meta.awardBattleResult('P2', localOne);
  assert.equal(localPaid.amount, 50);
  assert.equal(meta.getMastery().weaponDamage.RPG_7, 1000);
  assert.equal(meta.skinEntitlement('weapon', 'RPG_7', 'vua-he'), false, 'exactly 1000 is not >1000');

  const localTwo = sealedState('LOCAL', 'cp3-local-2', [
    player('NEWBOT', { sources: [rpg(1)] }),
    player('HUNTER'),
  ]);
  const unlockPaid = meta.awardBattleResult('P1', localTwo);
  assert.equal(meta.getMastery().weaponDamage.RPG_7, 1001);
  assert.equal(meta.skinEntitlement('weapon', 'RPG_7', 'vua-he'), true, '1001 lifetime RPG damage is entitled');
  assert.equal(unlockPaid.mastery.skinUnlocks[0]?.key, 'weapon:RPG_7:vua-he');
  assert.ok(meta.getMastery().unseenSkinUnlocks.includes('weapon:RPG_7:vua-he'));
  assert.ok(events.some((event) => event.type === 'apex:skin-unlocked' && event.detail.skin.key === 'weapon:RPG_7:vua-he'));
  meta.markSkinUnlockSeen('weapon:RPG_7:vua-he');
  assert.ok(!meta.getMastery().unseenSkinUnlocks.includes('weapon:RPG_7:vua-he'));

  const lab = meta.awardBattleResult('P1', sealedState('BOT', 'cp3-lab-1', [
    player('NEWBOT', { awards: [award('burst-king', 999)], sources: [rpg(5000)] }),
    player('HUNTER'),
  ], { labMode: true }));
  assert.equal(lab.ok, false);
  assert.equal(meta.getMastery().weaponDamage.RPG_7, 1001, 'Lab creates no mastery');
  assert.ok(!meta.heroMasteryProgress('NEWBOT').earnedIds.includes('burst-king'));
}

{
  const { meta } = bootMeta();
  const applicable = meta.masteryCatalog()
    .filter((def) => !def.heroId || def.heroId === 'NEWBOT')
    .map((def) => def.id);
  assert.equal(applicable.length, 42);
  meta.recordMasteryUnlocks(applicable.slice(0, 41).map((achievementId) => ({
    heroId: 'NEWBOT', achievementId, value: 1,
  })));
  assert.equal(meta.heroMasteryProgress('NEWBOT').earned, 41);
  assert.equal(meta.skinEntitlement('hero', 'ROBOT', 'ecobot'), false);
  const finalUnlock = meta.recordMasteryUnlocks([{
    heroId: 'NEWBOT', achievementId: applicable[41], value: 1,
  }]);
  assert.equal(meta.heroMasteryProgress('NEWBOT').earned, 42);
  assert.equal(meta.skinEntitlement('hero', 'ROBOT', 'ecobot'), true);
  assert.equal(finalUnlock.skinUnlocks[0]?.key, 'hero:ROBOT:ecobot');
  assert.equal(meta.skinProgress('hero', 'ROBOT', 'ecobot').remainingIds.length, 0);
}

{
  const legacy = {
    version: 1,
    credits: 425,
    ownedFighters: ['ROBOT', 'HUNTER'],
    lastSelectedP1: 'HUNTER',
    lastSelectedP2: 'ROBOT',
    totalSpins: 3,
    unlockedAt: { ROBOT: 0, HUNTER: 5 },
    arenaPaletteId: null,
  };
  const { meta } = bootMeta({ [WALLET_KEY]: JSON.stringify(legacy) });
  assert.equal(meta.credits(), 425, 'adding mastery preserves an old balance verbatim');
  assert.deepEqual(meta.getMastery(), {
    earned: {}, best: {}, weaponDamage: {}, recent: [], unseenSkinUnlocks: [],
  });

  const corrupt = {
    ...legacy,
    mastery: {
      earned: {
        ROBOT: { 'first-blood': 123, 'not-a-real-award': 1, 'signature-hunter': 1 },
        NEWBOT: { overkill: 456 },
      },
      best: { NEWBOT: { overkill: 300, bogus: 10 } },
      weaponDamage: { RPG_7: 1001, 'BAD-ID': 99 },
      recent: [
        { heroId: 'ROBOT', achievementId: 'first-blood', at: 123 },
        { heroId: 'NEWBOT', achievementId: 'signature-hunter', at: 999 },
      ],
      unseenSkinUnlocks: ['hero:ROBOT:ecobot', 'bogus'],
    },
  };
  const clean = bootMeta({ [WALLET_KEY]: JSON.stringify(corrupt) }).meta;
  assert.equal(clean.heroMasteryProgress('NEWBOT').earned, 2);
  assert.equal(clean.heroMasteryProgress('HUNTER').earned, 0);
  assert.deepEqual(Object.keys(clean.getMastery().weaponDamage), ['RPG_7']);
  assert.equal(clean.getMastery().recent.length, 1);
  assert.deepEqual(clean.getMastery().unseenSkinUnlocks, ['hero:ROBOT:ecobot']);
}

{
  const { meta, storage } = bootMeta();
  meta.recordMasteryUnlocks([{ heroId: 'NEWBOT', achievementId: 'first-blood', value: 1 }]);
  meta.awardBattleResult('P1', sealedState('LOCAL', 'cp3-reload-1', [
    player('NEWBOT', { sources: [rpg(1001)] }),
    player('HUNTER'),
  ]));
  const reloaded = bootMeta({ [WALLET_KEY]: storage.getItem(WALLET_KEY) }).meta;
  assert.equal(reloaded.getMastery().weaponDamage.RPG_7, 1001);
  assert.ok(reloaded.heroMasteryProgress('NEWBOT').earnedIds.includes('first-blood'));
  assert.equal(reloaded.awardBattleResult('P1', sealedState('LOCAL', 'cp3-reload-1', [
    player('NEWBOT', { sources: [rpg(1001)] }), player('HUNTER'),
  ])).reason, 'duplicate-claim');
  assert.equal(reloaded.getMastery().weaponDamage.RPG_7, 1001);
}

{
  const adminWindow = { APEX_ADMIN_AUTHORITY: { isAdminTestSessionActive: () => true } };
  const { meta } = bootMeta({}, adminWindow);
  assert.equal(meta.recordMasteryUnlocks([{ heroId: 'NEWBOT', achievementId: 'first-blood', value: 1 }]).reason, 'admin-test');
  assert.equal(meta.awardBattleResult('P1', sealedState('BOT', 'cp3-admin-1', [
    player('NEWBOT', { awards: [award('first-blood')], sources: [rpg(2000)] }),
    player('HUNTER'),
  ])).reason, 'admin-test');
  assert.deepEqual(meta.getMastery(), {
    earned: {}, best: {}, weaponDamage: {}, recent: [], unseenSkinUnlocks: [],
  });
}

// ── cosmetic authority: fail closed, preserve stored loadout ───────────────
{
  const cosmeticStorage = makeStorage({
    'apexChaos.cosmeticLoadout.v1': JSON.stringify({
      version: 1,
      p1: { hero: { ROBOT: 'ecobot' }, weapon: { RPG_7: 'vua-he' } },
      p2: { hero: {}, weapon: {} },
    }),
  });
  let providerEntitled = false;
  globalThis.window = {
    localStorage: cosmeticStorage,
    APEX_ARSENAL_META: { skinEntitlement: () => providerEntitled },
  };
  const { cosmetics } = await import('../src/game/cosmetics/cosmeticAuthority.js');
  cosmetics.register({
    kind: 'hero', baseId: 'ROBOT', id: 'ecobot', label: 'ECOBOT TEST RECORD',
    render: { actor: () => true },
  });
  cosmetics.register({
    kind: 'weapon', baseId: 'RPG_7', id: 'vua-he', label: 'VUA HE TEST RECORD',
    render: { weapon: () => true },
  });

  assert.equal(cosmetics.selected('p1', 'hero', 'ROBOT').id, 'default');
  assert.equal(cosmetics.selected('p1', 'weapon', 'RPG_7').id, 'default');
  const preserved = cosmetics.snapshot();
  assert.equal(preserved.p1.hero.ROBOT, 'ecobot', 're-lock preserves old hero loadout bytes');
  assert.equal(preserved.p1.weapon.RPG_7, 'vua-he', 're-lock preserves old weapon loadout bytes');
  const refused = cosmetics.equip('p2', 'hero', 'ROBOT', 'ecobot');
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'SKIN_LOCKED');
  assert.equal(cosmetics.resolve({ kind: 'hero', baseId: 'ROBOT', skinId: 'ecobot' }).id, 'default');
  assert.equal(cosmetics.resolve({ kind: 'weapon', baseId: 'RPG_7', skinId: 'vua-he' }).id, 'default');

  providerEntitled = true;
  assert.equal(cosmetics.selected('p1', 'hero', 'ROBOT').id, 'ecobot', 'true entitlement reactivates the preserved loadout');
  assert.equal(cosmetics.selected('p1', 'weapon', 'RPG_7').id, 'vua-he');
  assert.equal(cosmetics.resolve({ kind: 'hero', baseId: 'ROBOT', skinId: 'ecobot' }).id, 'ecobot');
  assert.equal(cosmetics.equip('p2', 'weapon', 'RPG_7', 'vua-he').ok, true);
}

// ── static integration proof for the live seam and CP3 surfaces ────────────
{
  const battle = read('public/game/modes/arsenalBattleRuntime.js');
  assert.match(battle, /evaluateLive\(\)/);
  assert.match(battle, /state\.battleMode === 'LOCAL' \|\| event\.sideIndex === 0/);
  const app = read('src/App.jsx');
  assert.match(app, /<AchievementToast \/>/);
  assert.match(app, /<SkinUnlockCelebration \/>/);
  const coach = read('src/ui/FirstPlayGuide.jsx');
  assert.match(coach, /apex\.alpha\.coach\.v2/);
  assert.match(coach, /APEX_GOLD_PROJECTION/);
  assert.match(coach, /Press J|Nhấn J/);
  assert.match(coach, /Press K|Nhấn K/);
  assert.match(coach, /battle-hud-open/, 'coach must recognize the same-document Battle HUD, not only a shell stage class');
  assert.match(coach, /#battleHudHost\.is-open/);
  const celebration = read('src/ui/SkinUnlockCelebration.jsx');
  assert.match(celebration, /battle-hud-open/, 'skin celebration must stay hidden while the Battle HUD is open');
  assert.match(celebration, /#battleHudHost\.is-open/);
  const meta = read('public/game/arsenal/arsenalMetaRuntime.js');
  assert.match(meta, /claimedMatchIds/);
  assert.match(meta, /foldMasteryResult\(current\.resultGold, mode\)/);
}

console.log('CP3 MASTERY GATE PASS: live classification, idempotent wallet fold, strict skin gates, cosmetic preservation');
