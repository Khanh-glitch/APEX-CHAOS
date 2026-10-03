// Focused pre-pilot product graph proof.
//
// This intentionally exercises the semantic authority plus the public
// mutation seams without booting legacy Quest routes. It is deterministic and
// browser-independent: node tools/testPrePilotProductGraph.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  PRODUCT_AVAILABILITY,
  PRODUCT_ECONOMY,
  PRODUCT_ROSTER,
  canLaunchProductSurface,
  installProductSurfaceAuthority,
  listProductSurfaces,
} from '../src/game/productSurface.js';
import {
  ARSENAL_LEGACY_QUEST_RUNTIMES,
  ARSENAL_PRODUCT_RUNTIMES,
  MODE_DEFERRED_RUNTIMES,
  WARMUP_GROUP_SEQUENCE,
} from '../src/game/runtimeManifest.js';

const REPO = process.cwd();
const report = { gates: {}, failures: [] };
function gate(name, fn) {
  try {
    const detail = fn();
    report.gates[name] = { pass: true, detail };
    console.log(`PASS  ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  } catch (error) {
    const detail = String(error?.stack || error);
    report.gates[name] = { pass: false, detail };
    report.failures.push(name);
    console.log(`FAIL  ${name} — ${detail}`);
  }
}

function makeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data); },
  };
}

function source(rel) {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function makeClassicContext(seed = {}) {
  const storage = makeStorage(seed);
  const calls = { select: 0, menu: 0, starts: [] };
  const win = {
    console,
    localStorage: storage,
    APEX_ARSENAL_CONFIG: { FIGHTER_SPEED: 450 },
    APEX_HERO_REWORK_REGISTRY: {
      productCutover: true,
      isCanonicalHero(id) {
        return ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR', 'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER'].includes(String(id));
      },
      displayNameFor(id) { return String(id).toUpperCase() === 'ICE' ? 'FROST' : String(id); },
    },
    FighterTypes: [],
    document: {
      body: { appendChild() {} },
      getElementById() { return null; },
      createElement() { return { style: {}, appendChild() {}, addEventListener() {}, remove() {} }; },
    },
    goToSelect() { calls.select += 1; },
    goToMenu() { calls.menu += 1; },
    startMatch() { calls.classicStarts = (calls.classicStarts || 0) + 1; },
    startArsenalBattleMode(p1, p2) { calls.starts.push({ p1, p2, profile: win.__apexArsenalBattleProfile }); },
    clearTimeout() {},
    setTimeout() { return 0; },
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    dispatchEvent() {},
  };
  win.window = win;
  const context = vm.createContext({
    window: win,
    document: win.document,
    localStorage: storage,
    console,
    Math,
    Date,
    JSON,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    performance: { now: () => 0 },
    p1Selection: null,
    p2Selection: null,
    FighterTypes: win.FighterTypes,
    goToSelect: win.goToSelect,
    goToMenu: win.goToMenu,
    startMatch: win.startMatch,
  });
  installProductSurfaceAuthority(win);
  vm.runInContext(source('public/game/arsenal/arsenalShellSelectRuntime.js'), context, { filename: 'arsenalShellSelectRuntime.js' });
  vm.runInContext(source('public/game/arsenal/arsenalMetaRuntime.js'), context, { filename: 'arsenalMetaRuntime.js' });
  return { win, context, storage, calls };
}

const expectedPublic = [
  'quest-01', 'bot-battle', 'local-1v1', 'fighter-shop', 'lucky-draw',
  'fighter-upgrade', 'dictionary', 'missions', 'achievements', 'account-profile',
];

gate('semantic-graph-and-admin-boundary', () => {
  const graph = listProductSurfaces();
  assert.deepEqual(graph.map((s) => s.id), expectedPublic);
  assert.equal(graph.filter((s) => s.availability === PRODUCT_AVAILABILITY.ACTIVE).map((s) => s.id).join(','),
    'bot-battle,local-1v1,fighter-shop,lucky-draw');
  assert.equal(graph.filter((s) => s.availability === PRODUCT_AVAILABILITY.LOCKED).length, 6);
  assert.equal(canLaunchProductSurface('arsenal-lab'), false);
  assert.equal(canLaunchProductSurface('arsenal-lab', { admin: true }), true);
  assert.equal(canLaunchProductSurface('arsenal-quest-ladder', { admin: true }), false);
  return { public: graph.length, active: graph.filter((s) => s.availability === 'ACTIVE').length };
});

gate('visible-roster-core-six-and-locked-six', () => {
  assert.deepEqual(PRODUCT_ROSTER.visibleIds, [
    'ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR',
    'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER',
  ]);
  assert.deepEqual(PRODUCT_ROSTER.playableIds, ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR']);
  assert.deepEqual(PRODUCT_ROSTER.lockedIds, ['BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER']);
  return { visible: PRODUCT_ROSTER.visibleIds.length, playable: PRODUCT_ROSTER.playableIds.length };
});

gate('economy-clean-state-and-mutation-legality', () => {
  const { win } = makeClassicContext();
  const meta = win.APEX_ARSENAL_META;
  assert.equal(meta.credits(), PRODUCT_ECONOMY.cleanStateCredits);
  assert.equal(meta.getState().credits, 350);
  assert.equal(meta.buy('BLACK_HOLE').reason, 'unavailable');
  assert.equal(meta.buy('PAINTER').reason, 'unavailable');
  assert.deepEqual(meta.poolLocked(), ['HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR']);
  // Clean-state 350 is deliberately enough for exactly one 350 AC draw.
  const draw = meta.spin(() => 0.999999);
  assert.equal(draw.ok, true);
  assert.ok(PRODUCT_ROSTER.playableIds.includes(draw.name));
  assert.ok(!PRODUCT_ROSTER.lockedIds.includes(draw.name));
  assert.equal(meta.credits(), 0);
  assert.equal(meta.spin(() => 0).reason, 'need');
  meta.award('proof', 1000);
  const bought = meta.buy('HUNTER');
  assert.equal(bought.ok, true);
  assert.equal(bought.credits, 0);
  return { credits: meta.credits(), draw: draw.name, shopCost: meta.SHOP_COST, drawCost: meta.DRAW_COST };
});

gate('newbie-migration-historic-ownership-and-stale-selection-safety', () => {
  const seed = {
    'apexChaos.arsenalMeta.v1': JSON.stringify({
      credits: 777,
      ownedFighters: ['NEWBIE', 'BLACK_HOLE', 'HUNTER'],
      lastSelectedP1: 'BLACK_HOLE',
      lastSelectedP2: 'NEWBIE',
      unlockedAt: { NEWBIE: 33, BLACK_HOLE: 44 },
    }),
  };
  const { win, storage } = makeClassicContext(seed);
  const state = win.APEX_ARSENAL_META.getState();
  assert.equal(state.credits, 777);
  assert.ok(state.ownedFighters.includes('ROBOT'));
  assert.ok(state.ownedFighters.includes('BLACK_HOLE'));
  assert.ok(state.ownedFighters.includes('HUNTER'));
  assert.ok(!state.ownedFighters.includes('NEWBIE'));
  assert.equal(state.lastSelectedP1, 'ROBOT');
  assert.equal(state.lastSelectedP2, 'ROBOT');
  assert.equal(state.unlockedAt.ROBOT, 33);
  assert.equal(state.unlockedAt.NEWBIE, undefined);
  const persisted = JSON.parse(storage.getItem('apexChaos.arsenalMeta.v1'));
  assert.ok(persisted.ownedFighters.includes('ROBOT'));
  assert.ok(!persisted.ownedFighters.includes('NEWBIE'));
  assert.equal(persisted.lastSelectedP1, 'ROBOT');
  return { owned: state.ownedFighters, p1: state.lastSelectedP1, p2: state.lastSelectedP2 };
});

gate('shell-public-selection-and-bot-profile-seam', () => {
  const { win, context, calls } = makeClassicContext();
  const shells = win.APEX_ARSENAL_SHELLS;
  assert.deepEqual(shells.ids, PRODUCT_ROSTER.visibleIds);
  assert.deepEqual(shells.roster().map((s) => s.name), PRODUCT_ROSTER.playableIds);
  assert.equal(shells.isPlayable('BLACK_HOLE'), false);
  assert.equal(shells.isVisible('BLACK_HOLE'), true);
  assert.ok(shells.typeFor('BLACK_HOLE')); // compatibility definition remains resolvable

  // Locked/stale handoff never invokes either active or classic battle.
  context.p1Selection = shells.typeFor('BLACK_HOLE');
  context.p2Selection = shells.typeFor('ROBOT');
  win.__apexArsenalSelectPending = true;
  win.__apexArsenalSelectionMode = 'local';
  win.startMatch();
  assert.equal(calls.starts.length, 0);
  assert.equal(calls.classicStarts || 0, 0);
  assert.ok(calls.select >= 1);

  // Local is the accepted Free Battle handoff.
  context.p1Selection = shells.typeFor('ROBOT');
  context.p2Selection = shells.typeFor('ROBOT');
  win.__apexArsenalSelectPending = true;
  win.__apexArsenalSelectionMode = 'local';
  win.startMatch();
  assert.deepEqual(calls.starts.at(-1), { p1: 'ROBOT', p2: 'ROBOT', profile: 'LOCAL' });

  // Bot uses the same safe handoff with the existing P2-AI profile marker.
  win.__apexArsenalSelectPending = true;
  win.__apexArsenalSelectionMode = 'bot';
  win.startMatch();
  assert.deepEqual(calls.starts.at(-1), { p1: 'ROBOT', p2: 'ROBOT', profile: 'BOT' });
  return { visible: shells.ids.length, selectable: shells.roster().length, starts: calls.starts };
});

gate('neutral-core-and-detached-warmup', () => {
  const active = ARSENAL_PRODUCT_RUNTIMES.map(([src]) => src);
  const legacy = ARSENAL_LEGACY_QUEST_RUNTIMES.map(([src]) => src);
  assert.ok(active.some((src) => src.includes('arsenalBattleRuntime.js')));
  assert.ok(!active.some((src) => src.includes('arsenalQuestRuntime.js')));
  assert.ok(!active.some((src) => src.includes('arsenalQuestLadder.js')));
  assert.ok(legacy.some((src) => src.includes('arsenalQuestRuntime.js')));
  assert.deepEqual(MODE_DEFERRED_RUNTIMES.arsenalQuest, MODE_DEFERRED_RUNTIMES.arsenalLegacyQuest);
  assert.ok(legacy.some((src) => src.includes('arsenalQuestLadder.js')));
  assert.ok(WARMUP_GROUP_SEQUENCE.includes('arsenalProduct'));
  assert.ok(!WARMUP_GROUP_SEQUENCE.includes('arsenalLegacyQuest'));
  assert.ok(!WARMUP_GROUP_SEQUENCE.includes('arsenalQuest'));
  const loader = source('src/game/runtimeLoader.js');
  assert.ok(!loader.includes("group === 'arsenalProduct') window.__apexDeferredRuntimesReady_arsenalQuest"));
  return { warmup: WARMUP_GROUP_SEQUENCE, activeRuntimes: active.length, legacyRuntimes: legacy.length };
});

gate('admin-lab-real-but-not-publicly-navigated', () => {
  const app = source('src/App.jsx');
  const battle = source('public/game/modes/arsenalBattleRuntime.js');
  const menu = app.slice(app.indexOf('<div id="menu-screen"'), app.indexOf('<div id="select-screen"'));
  assert.ok(app.includes('window.apexLaunchArsenalLab'));
  assert.ok(app.includes("launchProductSurface('arsenal-lab', { admin: true })"));
  assert.ok(battle.includes('window.startArsenalLab = function startArsenalLab()'));
  assert.ok(battle.includes('window.startArsenalBattleMode'));
  assert.ok(!menu.includes('ARSENAL LAB'));
  return 'admin API reaches real neutral battle Lab; normal menu has no Lab node';
});

gate('no-retired-public-menu-actions', () => {
  const app = source('src/App.jsx');
  const menu = app.slice(app.indexOf('<div id="menu-screen"'), app.indexOf('<div id="select-screen"'));
  for (const retired of ['Classic Play', 'APEX CONTROL', '3-Phase', 'Saitama', 'Tournament', 'Solo 1v1 Local', 'ARSENAL QUEST', 'ARSENAL LAB']) {
    assert.ok(!menu.includes(retired), `${retired} leaked into public menu`);
  }
  assert.ok(menu.includes('data-product-surface'));
  assert.ok(menu.includes('PUBLIC_PRODUCT_SURFACES'));
  return 'normal menu derives from semantic graph only';
});

process.exitCode = report.failures.length ? 1 : 0;
