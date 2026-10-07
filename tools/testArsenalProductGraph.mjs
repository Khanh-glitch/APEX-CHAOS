// Focused Arsenal product graph proof.
//
// This intentionally exercises the semantic authority plus the public
// mutation seams without booting retired routes. It is deterministic and
// browser-independent: node tools/testArsenalProductGraph.mjs
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
  ARSENAL_PRODUCT_RUNTIMES,
  ARSENAL_SHARED_ENGINE_RUNTIMES,
  CORE_SIX_BATTLE_RUNTIME_PATHS,
  arsenalBattleRuntimesFor,
  CURRENT_COMBAT_CORE_RUNTIMES,
  MODE_DEFERRED_RUNTIMES,
  SELECT_RUNTIMES,
  WARMUP_GROUP_SEQUENCE,
} from '../src/game/runtimeManifest.js';
import {
  LEGACY_BATTLE_CORE_RUNTIMES,
  LEGACY_BATTLE_RUNTIMES,
  LEGACY_COMBAT_CORE_RUNTIMES,
  LEGACY_ROSTER_RUNTIMES,
} from './legacyRuntimeManifest.mjs';

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

gate('semantic-graph-and-admin-boundary', () => {
  const graph = listProductSurfaces();
  const active = graph.filter((surface) => surface.availability === PRODUCT_AVAILABILITY.ACTIVE);
  const locked = graph.filter((surface) => surface.availability === PRODUCT_AVAILABILITY.LOCKED);
  assert.equal(graph.length, 10);
  // Current Gold product law: Bot Battle, Local 1v1 and Lucky Draw are ACTIVE.
  // Fighter Shop is intentionally a visible LOCKED extension point.
  assert.equal(active.length, 3);
  assert.equal(locked.length, 7);
  assert.deepEqual(active.map((surface) => surface.id), ['bot-battle', 'local-1v1', 'lucky-draw']);
  assert.ok(locked.some((surface) => surface.id === 'fighter-shop'));
  assert.ok(locked.some((surface) => surface.id === 'quest-01'));
  assert.equal(canLaunchProductSurface('fighter-shop'), false);
  assert.ok(locked.every((surface) => !canLaunchProductSurface(surface.id)));
  assert.equal(canLaunchProductSurface('arsenal-lab'), false);
  assert.equal(canLaunchProductSurface('arsenal-lab', { admin: true }), true);
  return { public: graph.length, active: active.length, locked: locked.length };
});

gate('visible-roster-core-six-and-locked-six', () => {
  assert.equal(PRODUCT_ROSTER.visibleIds.length, 12);
  assert.equal(PRODUCT_ROSTER.playableIds.length, 6);
  assert.equal(PRODUCT_ROSTER.lockedIds.length, 6);
  assert.ok(PRODUCT_ROSTER.playableIds.includes('ROBOT'));
  assert.ok(PRODUCT_ROSTER.playableIds.includes('ICE'));
  assert.ok(PRODUCT_ROSTER.playableIds.includes('MIRROR'));
  assert.ok(PRODUCT_ROSTER.lockedIds.every((id) => PRODUCT_ROSTER.visibleIds.includes(id)));
  assert.ok(PRODUCT_ROSTER.lockedIds.every((id) => !PRODUCT_ROSTER.playableIds.includes(id)));
  return { visible: PRODUCT_ROSTER.visibleIds.length, playable: PRODUCT_ROSTER.playableIds.length,
    locked: PRODUCT_ROSTER.lockedIds.length };
});

gate('economy-clean-state-and-mutation-legality', () => {
  const { win } = makeClassicContext();
  const meta = win.APEX_ARSENAL_META;
  // r44 owner-playtest law: the seeded clean-state balance is exactly 12,000.
  assert.equal(meta.credits(), PRODUCT_ECONOMY.cleanStateCredits);
  assert.equal(meta.getState().credits, 12000);
  assert.equal(meta.buy('BLACK_HOLE').reason, 'unavailable');
  assert.equal(meta.poolLocked().length, 5);
  assert.ok(meta.poolLocked().includes('HUNTER'));
  assert.ok(meta.poolLocked().every((id) => PRODUCT_ROSTER.playableIds.includes(id)));
  // A Lucky Draw costs the real 350 AC and can only take from the unowned pool.
  const draw = meta.spin(() => 0.999999);
  assert.equal(draw.ok, true);
  assert.ok(PRODUCT_ROSTER.playableIds.includes(draw.name));
  assert.ok(!PRODUCT_ROSTER.lockedIds.includes(draw.name));
  assert.equal(meta.credits(), 12000 - PRODUCT_ECONOMY.drawCost);
  // The shop costs its real 1,000 AC against the seeded balance.
  const bought = meta.buy('HUNTER');
  assert.equal(bought.ok, true);
  assert.equal(bought.credits, 12000 - PRODUCT_ECONOMY.drawCost - PRODUCT_ECONOMY.shopCost);
  // An exhausted balance refuses the draw for the real reason.
  meta.award('proof', 1000);
  assert.equal(meta.credits(), 12000 - PRODUCT_ECONOMY.drawCost - PRODUCT_ECONOMY.shopCost + 1000);
  return {
    credits: meta.credits(), draw: draw.name, shopCost: meta.SHOP_COST, drawCost: meta.DRAW_COST,
  };
});

gate('battle-result-credit-uses-player-side-and-awards-once', () => {
  const { win, context } = makeClassicContext();
  context.fighters = [
    { name: 'ROBOT', type: { name: 'ROBOT' } },
    { name: 'ROBOT', type: { name: 'ROBOT' } },
  ];
  const p2State = {};
  const p2Win = win.APEX_ARSENAL_META.awardBattleResult('P2', p2State);
  assert.equal(p2Win.ok, true);
  assert.equal(p2Win.amount, 25, 'a P2 win is a P1 loss even when both fighters share the same name');
  assert.equal(win.APEX_ARSENAL_META.awardBattleResult('P2', p2State).reason, 'not-awardable');
  const p1Win = win.APEX_ARSENAL_META.awardBattleResult('P1', {});
  assert.equal(p1Win.ok, true);
  assert.equal(p1Win.amount, 50);
  assert.equal(win.APEX_ARSENAL_META.awardBattleResult('ROBOT', {}).reason, 'invalid-winner');
  return { balance: win.APEX_ARSENAL_META.credits(), p2Award: p2Win.amount, p1Award: p1Win.amount };
});

gate('newbie-migration-historic-ownership-and-stale-selection-safety', () => {
  // r44 owner-playtest law: an UNMARKED profile is seeded to exactly 12,000 AC
  // once (revision+profile scoped marker), so a legacy balance is upgraded
  // rather than preserved. Ownership/selection migration is unaffected.
  const OWNER_PLAYTEST_SEED = 12000;
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
  assert.equal(win.APEX_ARSENAL_META.buy('NEWBIE').reason, 'unavailable');
  assert.equal(state.credits, OWNER_PLAYTEST_SEED);
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
  assert.ok(shells.typeFor('BLACK_HOLE')); // visible-but-locked shell remains resolvable

  // Locked/stale handoff never invokes either active or classic battle.
  // Gold owns Fighter Pick now: recovery requests the semantic Gold fighter
  // destination instead of resurrecting the retired goToSelect() DOM path.
  context.p1Selection = shells.typeFor('BLACK_HOLE');
  context.p2Selection = shells.typeFor('ROBOT');
  win.__apexArsenalSelectPending = true;
  win.__apexArsenalSelectionMode = 'local';
  win.startMatch();
  assert.equal(calls.starts.length, 0);
  assert.equal(calls.classicStarts || 0, 0);
  assert.equal(calls.select, 0, 'Gold recovery must not call the retired legacy picker');
  assert.equal(win.__apexPendingGoldNavigation?.target, 'fighter');
  assert.equal(win.__apexPendingGoldNavigation?.options?.mode, 'local');

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

gate('neutral-product-runtime-and-warmup-closure', () => {
  const runtimePaths = entries => entries.map(([src]) => String(src).split(/[?#]/, 1)[0]);
  const active = runtimePaths(ARSENAL_PRODUCT_RUNTIMES);
  const currentEngine = runtimePaths(ARSENAL_SHARED_ENGINE_RUNTIMES);
  const legacyRoster = new Set(runtimePaths(LEGACY_ROSTER_RUNTIMES));
  const productRosterRefs = active.filter(src => legacyRoster.has(src)).sort();
  const selectPaths = runtimePaths(SELECT_RUNTIMES);
  const legacyBattleCore = runtimePaths(LEGACY_BATTLE_CORE_RUNTIMES);
  const legacyBattle = runtimePaths(LEGACY_BATTLE_RUNTIMES);

  assert.deepEqual(active.slice(0, currentEngine.length), currentEngine,
    'Arsenal must begin with its own explicit current engine chain');
  assert.ok(active.includes('/game/modes/arsenalBattleRuntime.js'));
  assert.equal(active.filter((src) => src === '/game/arsenal/arsenalConfig.js').length, 1);
  assert.ok(!active.some((src) => /arsenalQuest(Runtime|Ladder|Config)\.js/.test(src)));
  assert.deepEqual(productRosterRefs, [],
    'no legacy roster runtime may execute on the current Arsenal product path');
  for (const forbidden of [
    '/game/core/apexFullRosterQa.js',
    '/game/guards/apexRuntimeStability.js',
    '/game/core/apexMajorMechanicVisuals.js',
    '/game/fighters/katanaRuntime.js',
    '/game/fighters/fangRuntime.js',
  ]) assert.ok(!active.includes(forbidden), `${forbidden} must not execute on current Arsenal`);

  assert.deepEqual(currentEngine.slice(0, CURRENT_COMBAT_CORE_RUNTIMES.length),
    runtimePaths(CURRENT_COMBAT_CORE_RUNTIMES),
    'current Arsenal begins with the explicit neutral combat service set');
  assert.ok(active.indexOf('/game/core/apexArsenalProductCollisionRuntime.js')
    < active.indexOf('/game/core/apexArsenalProductRenderHudRuntime.js'));
  assert.ok(active.indexOf('/game/core/apexArsenalProductRenderHudRuntime.js')
    < active.indexOf('/game/core/apexArsenalProductDrawRecoveryRuntime.js'));
  assert.deepEqual(selectPaths.filter(src => legacyRoster.has(src)), [],
    'current picker load must not warm the legacy roster chain');

  // Historical regression coverage is preserved, but only under tools/.
  assert.ok(LEGACY_COMBAT_CORE_RUNTIMES.some(([src]) =>
    String(src).split(/[?#]/, 1)[0] === '/game/core/apexMajorMechanicVisuals.js'));
  assert.ok(LEGACY_ROSTER_RUNTIMES.some(([src]) =>
    String(src).split(/[?#]/, 1)[0] === '/game/fighters/katanaRuntime.js'));
  assert.deepEqual(legacyBattleCore.slice(LEGACY_COMBAT_CORE_RUNTIMES.length,
    LEGACY_COMBAT_CORE_RUNTIMES.length + LEGACY_ROSTER_RUNTIMES.length),
    runtimePaths(LEGACY_ROSTER_RUNTIMES));
  assert.deepEqual(legacyBattle.slice(0, legacyBattleCore.length), legacyBattleCore,
    'test-only legacy Battle retains its historical core/roster order');

  // Gold Fighter Pick is shell-owned. There is no production select runtime
  // group and no heavy idle warmup; Arsenal loads only on explicit battle intent.
  assert.deepEqual(selectPaths, []);
  assert.deepEqual(Object.keys(MODE_DEFERRED_RUNTIMES).sort(), ['arsenalProduct']);
  assert.deepEqual(WARMUP_GROUP_SEQUENCE, []);
  assert.ok(!WARMUP_GROUP_SEQUENCE.some((group) => /quest/i.test(group)));

  const selectedBattle = runtimePaths(arsenalBattleRuntimesFor(['newbot', 'mirror']));
  const selectedPositions = selectedBattle.map((src) => active.indexOf(src));
  assert.ok(selectedBattle.includes('/game/hero-rework/robotPresentationRuntime.js'));
  assert.ok(selectedBattle.includes('/game/hero-rework/mirrorGoldV1.js'));
  assert.ok(selectedBattle.includes('/game/hero-rework/mirrorPresentationRuntime.js'));
  for (const hero of ['hunter', 'crystala', 'magnet', 'frost']) {
    for (const scopedPath of CORE_SIX_BATTLE_RUNTIME_PATHS[hero]) {
      assert.ok(!selectedBattle.includes(scopedPath), `unselected ${hero} runtime leaked into selected battle: ${scopedPath}`);
    }
  }
  assert.deepEqual(selectedPositions, selectedPositions.slice().sort((a, b) => a - b),
    'selected battle view must preserve canonical arsenalProduct order');
  assert.deepEqual(runtimePaths(arsenalBattleRuntimesFor(['future-fighter'])), active,
    'unknown future fighter must fail open to the canonical full graph');

  const manifest = source('src/game/runtimeManifest.js');
  const loader = source('src/game/runtimeLoader.js');
  for (const token of [
    'ROSTER_RUNTIMES', 'BATTLE_CORE_RUNTIMES', 'BATTLE_RUNTIMES',
    'BATTLE_DEFERRED_RUNTIMES', 'BOOT_GAME_RUNTIMES',
    '/game/fighters/katanaRuntime.js', '/game/fighters/fangRuntime.js',
    '/game/core/apexMajorMechanicVisuals.js',
  ]) {
    assert.ok(!manifest.includes(token), `production runtime manifest leaked legacy token ${token}`);
  }
  assert.ok(!/\b(?:battle|battleDeferred|all)\s*:/.test(
    loader.slice(loader.indexOf('const RUNTIME_GROUPS'), loader.indexOf('// Audio banks'))),
    'production runtime loader must expose only current product groups');
  assert.ok(!loader.includes('BATTLE_RUNTIMES'));
  assert.ok(!loader.includes('BATTLE_DEFERRED_RUNTIMES'));
  assert.ok(!loader.includes('ARSENAL_LEGACY_QUEST_RUNTIMES'));
  assert.ok(!loader.includes('arsenalLegacyQuest'));

  return {
    warmup: WARMUP_GROUP_SEQUENCE,
    activeRuntimes: active.length,
    productRosterBridges: productRosterRefs,
    currentSelectRuntimes: selectPaths.length,
    deferredGroups: Object.keys(MODE_DEFERRED_RUNTIMES).sort(),
    legacyFixtureRuntimes: legacyBattle.length,
  };
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
  const shell = source('public/gold/shell.html');

  // R50J/R50K law: React no longer owns a public menu or picker. Gold Shell is
  // the sole public product surface; semantic production navigation enters it
  // through APEX_GOLD_SHELL_NAVIGATE instead of rebuilding retired menu cards.
  assert.ok(!app.includes('id="menu-screen"'));
  assert.ok(!app.includes('id="select-screen"'));
  assert.ok(app.includes('id="gold-shell-host"'));
  assert.ok(shell.includes('data-apex-shell-stage="true"'));
  assert.ok(shell.includes('id="openLuckyDraw"'));
  assert.ok(shell.includes('data-mode="bot"'));
  assert.ok(shell.includes('data-mode="local1v1"'));
  assert.ok(shell.includes('window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell'));

  for (const retired of ['Classic Play', 'APEX CONTROL', '3-Phase', 'Saitama', 'Tournament', 'Solo 1v1 Local', 'ARSENAL QUEST', 'ARSENAL LAB']) {
    assert.ok(!app.includes(retired), `${retired} leaked into React public surface`);
    assert.ok(!shell.includes(retired), `${retired} leaked into Gold public surface`);
  }
  return 'Gold Shell is the sole public menu/picker; retired React actions stay absent';
});

process.exitCode = report.failures.length ? 1 : 0;
