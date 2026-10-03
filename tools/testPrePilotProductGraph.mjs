// Focused pre-pilot product-graph cutover proof.
// Run: node tools/testPrePilotProductGraph.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  ARSENAL_HUB_RUNTIMES,
  LEGACY_ARSENAL_QUEST_RUNTIMES,
  MODE_DEFERRED_RUNTIMES,
  WARMUP_GROUP_SEQUENCE,
} from '../src/game/runtimeManifest.js';

const PRODUCT_RUNTIME = 'public/game/arsenal/apexProductSurfaceRuntime.js';
const META_RUNTIME = 'public/game/arsenal/arsenalMetaRuntime.js';
const PRODUCT_SOURCE = fs.readFileSync(PRODUCT_RUNTIME, 'utf8');
const META_SOURCE = fs.readFileSync(META_RUNTIME, 'utf8');
const APP_SOURCE = fs.readFileSync('src/App.jsx', 'utf8');
const SHELL_SOURCE = fs.readFileSync('public/game/arsenal/arsenalShellSelectRuntime.js', 'utf8');
const MODE_SOURCE = fs.readFileSync('public/game/modes/arsenalQuestRuntime.js', 'utf8');

function makeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); },
  };
}

function makeProductContext(seed = {}) {
  const localStorage = makeStorage(seed);
  const context = {
    console,
    localStorage,
    setTimeout() { return 0; },
    clearTimeout() {},
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
    document: {
      getElementById() { return null; },
      body: { appendChild() {} },
      head: { appendChild() {} },
      createElement() { return { style: {}, appendChild() {}, addEventListener() {}, setAttribute() {}, querySelectorAll() { return []; } }; },
    },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(PRODUCT_SOURCE, context, { filename: PRODUCT_RUNTIME });
  vm.runInContext(META_SOURCE, context, { filename: META_RUNTIME });
  return context;
}

function paths(entries) { return entries.map(([src]) => src); }
function hasPath(entries, fragment) { return paths(entries).some((src) => src.includes(fragment)); }
function assertJsonEqual(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

const ctx = makeProductContext();
const P = ctx.APEX_PRODUCT_SURFACES;
const M = ctx.APEX_ARSENAL_META;

// One frozen, queryable authority owns the complete public graph.
assert.equal(P, ctx.APEX_CHAOS_PRODUCT);
assert.equal(P, ctx.APEX_PRODUCT);
assertJsonEqual(
  P.publicSurfaces().map((surface) => [surface.id, surface.availability]),
  [
    ['quest-01', 'LOCKED'],
    ['bot-battle', 'ACTIVE'],
    ['local-1v1', 'ACTIVE'],
    ['fighter-shop', 'ACTIVE'],
    ['lucky-draw', 'ACTIVE'],
    ['fighter-upgrade', 'LOCKED'],
    ['dictionary', 'LOCKED'],
    ['missions', 'LOCKED'],
    ['achievements', 'LOCKED'],
    ['account-profile', 'LOCKED'],
  ],
);
assertJsonEqual(P.activeRosterIds(), ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR']);
assertJsonEqual(P.visibleRosterIds(), [
  'ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR',
  'BLACK_HOLE', 'MATH_V2', 'RUBBER', 'TIME', 'SLIME', 'SNIPER',
]);
assert.equal(P.displayNameFor('ROBOT'), 'NEWBOT');
assert.equal(P.displayNameFor('CRYSTAL'), 'CRYSTALA');
assert.equal(P.displayNameFor('ICE'), 'FROST');
assert.equal(P.request('quest-01').ok, false);
assert.equal(P.request('arsenal-lab').ok, false);
assert.equal(P.request('arsenal-lab', { developer: true }).ok, true);
assert.equal(P.request('classic-play').reason, 'detached');
assert.equal(P.BOT_BATTLE_SEAM.launcher, 'arsenalShellSelectRuntime.beginSelection({ mode: "bot" })');

// Fresh economy stays 350; the old owner grant has no normal product path.
assert.equal(M.credits(), 350);
assert.equal(M.owns('ROBOT'), true);
assert.equal(M.buy('BLACK_HOLE').reason, 'not-available');
assert.equal(M.buy('NEWBIE').ok, false);
assertJsonEqual(M.poolLocked(), ['HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR']);
assert.equal(M.spin(() => 0).ok, true);
assert.equal(M.credits(), 0);
assert.equal(M.owns('HUNTER'), true);
assert.equal(M.poolLocked().includes('BLACK_HOLE'), false);
assert.equal(/OWNER_TEST_CREDITS|applyOwnerTestCreditGrant|12000/.test(META_SOURCE), false);

// The Shell consumes the authority below the renderer: it exposes only Core
// Six and rejects an injected locked/unowned match selection before launch.
const SHELL_RUNTIME = 'public/game/arsenal/arsenalShellSelectRuntime.js';
const shellSource = fs.readFileSync(SHELL_RUNTIME, 'utf8');
ctx.APEX_HERO_REWORK_REGISTRY = { productCutover: true };
ctx.APEX_ARSENAL_CONFIG = { FIGHTER_SPEED: 100 };
ctx.FighterTypes = P.activeRosterIds().map((name, index) => ({
  name, color: `#00${index}000`, desc: name, speed: 100, init() {}, draw() {},
}));
ctx.goToSelect = () => { ctx.__wentToSelect = true; };
ctx.goToMenu = () => {};
ctx.startMatch = () => 'classic-fallthrough';
vm.runInContext(shellSource, ctx, { filename: SHELL_RUNTIME });
const S = ctx.APEX_ARSENAL_SHELLS;
assertJsonEqual(S.ids, ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR']);
assert.equal(S.selectionTypeFor('BLACK_HOLE'), null);
assert.equal(S.selectionTypeFor('CRYSTAL'), null, 'active but unowned fighters cannot enter a match');
assert.equal(S.selectionTypeFor('ROBOT').name, 'ROBOT');
let launched = null;
let rerouted = null;
ctx.startArsenalQuestMode = () => {};
ctx.startArsenalProductBattle = (p1, p2) => { launched = [p1, p2]; return { ok: true }; };
ctx.openApexProductSurface = (id) => { rerouted = id; return { ok: true }; };
ctx.p1Selection = S.typeFor('BLACK_HOLE');
ctx.p2Selection = S.typeFor('ROBOT');
ctx.__apexArsenalSelectPending = true;
ctx.__apexArsenalSelectionMode = 'local';
ctx.startMatch();
assert.equal(launched, null);
assert.equal(rerouted, 'local-1v1');
ctx.p1Selection = S.typeFor('ROBOT');
ctx.p2Selection = S.typeFor('ROBOT');
ctx.__apexArsenalSelectPending = true;
ctx.__apexArsenalSelectionMode = 'bot';
ctx.startMatch();
assert.equal(JSON.stringify(launched), JSON.stringify(['ROBOT', 'ROBOT']));
assert.equal(ctx.__apexArsenalBattleKind, 'BOT_BATTLE');

// Saved credits and ownership are retained; only stale current picks are
// sanitized to a playable default. NEWBIE migration remains idempotent.
const saveKey = 'apexChaos.arsenalMeta.v1';
const preserved = makeProductContext({
  [saveKey]: JSON.stringify({
    version: 1,
    credits: 7777,
    ownedFighters: ['NEWBIE', 'BLACK_HOLE', 'SNIPER', 'HUNTER'],
    lastSelectedP1: 'BLACK_HOLE',
    lastSelectedP2: 'SNIPER',
    totalSpins: 4,
    unlockedAt: { NEWBIE: 12, BLACK_HOLE: 20, SNIPER: 21, HUNTER: 22 },
  }),
});
const preservedState = preserved.APEX_ARSENAL_META.getState();
assert.equal(preservedState.credits, 7777);
assertJsonEqual(preservedState.ownedFighters, ['ROBOT', 'BLACK_HOLE', 'SNIPER', 'HUNTER']);
assert.equal(preservedState.lastSelectedP1, 'ROBOT');
assert.equal(preservedState.lastSelectedP2, 'ROBOT');
assert.equal(preserved.APEX_ARSENAL_META.owns('BLACK_HOLE'), true);
assert.equal(preserved.APEX_ARSENAL_META.canSelect('BLACK_HOLE'), false);
assert.equal(preserved.APEX_ARSENAL_META.filterOwned([{ name: 'ROBOT' }, { name: 'HUNTER' }, { name: 'BLACK_HOLE' }]).map((fighter) => fighter.name).join(','), 'ROBOT,HUNTER');

// Normal public boot/hub/core paths exclude the historical ladder. It remains
// accessible only through an explicit compatibility group.
assert.deepEqual(WARMUP_GROUP_SEQUENCE, ['arsenalHub', 'select']);
assert.equal(hasPath(MODE_DEFERRED_RUNTIMES.arsenalCore, 'arsenalQuestLadder.js'), false);
assert.equal(hasPath(ARSENAL_HUB_RUNTIMES, 'arsenalQuestLadder.js'), false);
assert.equal(hasPath(LEGACY_ARSENAL_QUEST_RUNTIMES, 'arsenalQuestLadder.js'), true);
const legacyPaths = paths(LEGACY_ARSENAL_QUEST_RUNTIMES);
assert.equal(legacyPaths.findIndex((src) => src.includes('arsenalQuestLadder.js')), legacyPaths.findIndex((src) => src.includes('arsenalShellSelectRuntime.js')) + 1, 'legacy wrapper insertion order must stay compatible');
assert.equal(hasPath(MODE_DEFERRED_RUNTIMES.arsenalCore, 'apexProductSurfaceRuntime.js'), true);
assert.equal(hasPath(ARSENAL_HUB_RUNTIMES, 'apexProductSurfaceRuntime.js'), true);

// Public React entry no longer renders the legacy seven-card menu. Admin Lab
// is intentionally absent from it, while the developer seam is present in
// Meta and result flow has a Bot-specific result/action branch.
assert.equal(APP_SOURCE.includes('const MENU_BUTTONS = ['), false);
assert.equal(APP_SOURCE.includes('authority?.publicSurfaces'), true, 'App must render the authority query, not a second graph table');
assert.equal(APP_SOURCE.includes('PRODUCT_SURFACE_FALLBACK'), false);
assert.equal(APP_SOURCE.includes("arsenal-lab'"), false);
assert.equal(META_SOURCE.includes('window.openArsenalLab = openDeveloperLab;'), true);
assert.equal(META_SOURCE.includes("P.request ? P.request('arsenal-lab', { developer: true })"), true);
assert.equal(SHELL_SOURCE.includes("beginSelection({ mode: 'bot' })"), false, 'source must not fabricate a second bot launcher');
assert.equal(SHELL_SOURCE.includes("window.__apexArsenalBotBattle = mode === 'bot';"), true);
assert.equal(MODE_SOURCE.includes("state.productBattleKind === 'BOT_BATTLE'"), true);
assert.equal(MODE_SOURCE.includes("'BOT BATTLE RESULT'"), true);
assert.equal(MODE_SOURCE.includes('M.openBotPick'), true);
assert.equal(MODE_SOURCE.includes("reason: 'product-fighter-not-eligible'"), true);

console.log('[PRE-PILOT PRODUCT GRAPH] PASS');
console.log('  surfaces=10 public; activeRoster=6; visibleRoster=12; freshCredits=350');
console.log('  public warmup/core detached from legacy ladder; Lab admin seam and Bot result route verified');
