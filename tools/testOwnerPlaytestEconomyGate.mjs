// ---------------------------------------------------------------------------
// A1 production progression + economy gate (replaces the r44 owner-playtest
// gate; the useful coverage is retained, the law is now production law).
//
// Executes the REAL public/game/arsenal/arsenalMetaRuntime.js source against a
// deterministic storage shim and proves:
//
//   · a genuinely new profile starts at exactly 350 AC with ROBOT (NEWBOT)
//     as the only owned fighter — no 12,000 AC seed, no roster override,
//   · existing balances/ownership are preserved verbatim (no refill, no
//     clawback, no destructive reset) and a refresh NEVER refills AC,
//   · Lucky Draw still costs the real 350 AC against the REAL unowned pool,
//   · normal selection requires real ownership; the playable roster is
//     test-selectable ONLY inside an authorized Admin Test session, which
//     still fabricates no ownership and never widens the draw pool,
//   · match rewards follow the A1 table by ACTUAL mode+outcome
//     (BOT win 200 / BOT loss 25 provisional / LOCAL completion 50 either
//     winner / Lab+Admin+invalid 0) and pay exactly once per sealed match
//     id — across duplicate callbacks AND reloads,
//   · there is no parallel currency variable (the one AC state is the balance).
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(path.join(ROOT, 'public/game/arsenal/arsenalMetaRuntime.js'), 'utf8');

const notes = [];
const failures = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return true; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
  return false;
}

const CORE_SIX = ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'];
const FUTURE = ['SLIME']; // visible-but-locked extension point
const KEY = 'apexChaos.arsenalMeta.v1';

function makeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}
function boot(initial, extraWindow) {
  const storage = makeStorage(initial);
  const window = {
    localStorage: storage,
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return true; },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    console,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    APEX_PRODUCT_SURFACE: {
      roster: { visibleIds: [...CORE_SIX, ...FUTURE], playableIds: CORE_SIX },
      canLaunch: () => true,
    },
    ...(extraWindow || {}),
  };
  const ctx = vm.createContext({
    window, console, localStorage: storage, setTimeout, clearTimeout,
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map,
    CustomEvent: window.CustomEvent,
  });
  vm.runInContext(`(function(){ with (window) {\n${SOURCE}\n} })();`, ctx, { filename: 'arsenalMetaRuntime.js' });
  return { meta: window.APEX_ARSENAL_META, storage, window };
}
const storedOf = (storage) => JSON.parse(storage.getItem(KEY));

// ── 1. a genuinely new player: 350 AC, NEWBOT only ────────────────────────
{
  const { meta, storage } = boot({});
  check('meta runtime registers', !!meta);
  check('fresh profile starts at exactly 350 AC', meta.credits() === 350, `credits=${meta.credits()}`);
  check('fresh profile owns ROBOT (NEWBOT) only',
    JSON.stringify(meta.getState().ownedFighters) === '["ROBOT"]',
    JSON.stringify(meta.getState().ownedFighters));
  check('fresh default selection is ROBOT on both sides',
    meta.getState().lastSelectedP1 === 'ROBOT' && meta.getState().lastSelectedP2 === 'ROBOT');
  const stored = storedOf(storage);
  check('the fresh state is persisted through the real economy save', stored.credits === 350);
  check('no owner-playtest seed is applied or marked',
    !stored.ownerPlaytestAcSeed && meta.OWNER_PLAYTEST_AC_SEED === 0,
    JSON.stringify(stored.ownerPlaytestAcSeed));
  check('the roster selection override is disabled for normal players',
    meta.OWNER_PLAYTEST_CORE_SIX_UNLOCK === false);
  const balanceFields = Object.entries(stored)
    .filter(([k, v]) => typeof v === 'number' && /credit|balance|coin|ac/i.test(k))
    .map(([k]) => k);
  check('no parallel currency variable is introduced (single credits balance)',
    balanceFields.length === 1 && balanceFields[0] === 'credits', balanceFields.join(','));
}

// ── 2. existing profiles are preserved — never refilled, never reset ──────
{
  const legacy = { version: 1, credits: 425, ownedFighters: ['ROBOT', 'HUNTER'], lastSelectedP1: 'HUNTER', lastSelectedP2: 'ROBOT', totalSpins: 3, unlockedAt: { ROBOT: 0, HUNTER: 5 }, arenaPaletteId: null };
  const { meta } = boot({ [KEY]: JSON.stringify(legacy) });
  check('an existing 425 AC balance is preserved (no upgrade, no reset)',
    meta.credits() === 425, `credits=${meta.credits()}`);
  check('existing ownership is preserved',
    meta.owns('HUNTER') === true && meta.owns('ROBOT') === true);
}
{
  // A profile seeded under the retired r44 law keeps its CURRENT balance:
  // A1 neither refills it nor claws it back.
  const retired = {
    version: 1, credits: 11650, ownedFighters: ['ROBOT'],
    lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 1,
    unlockedAt: { ROBOT: 0 }, arenaPaletteId: null,
    ownerPlaytestAcSeed: { revision: '20261005-owner-playtest-r44', profile: KEY, at: 1 },
  };
  const { meta, storage } = boot({ [KEY]: JSON.stringify(retired) });
  check('a retired-seed profile keeps its current balance verbatim',
    meta.credits() === 11650, `credits=${meta.credits()}`);
  const refreshed = boot({ [KEY]: storage.getItem(KEY) });
  check('refreshing it never refills', refreshed.meta.credits() === 11650);
}

// ── 3. ordinary refresh / re-login never refills ──────────────────────────
{
  const { meta, storage } = boot({});
  const spin = meta.spin(() => 0);
  check('Lucky Draw costs the real 350 AC (fresh 350 → 0)',
    spin.ok === true && spin.credits === 0, JSON.stringify(spin));
  check('the drawn fighter becomes really owned', meta.owns(spin.name) === true);
  const refused = meta.spin(() => 0);
  check('a second draw is refused for the real reason (need 350)',
    refused.ok === false && refused.reason === 'need' && refused.need === 350,
    JSON.stringify(refused));
  const refreshed = boot({ [KEY]: storage.getItem(KEY) });
  check('an ordinary refresh does NOT refill (0 stays 0)',
    refreshed.meta.credits() === 0, `credits=${refreshed.meta.credits()}`);
  check('the drawn ownership survives the refresh',
    refreshed.meta.owns(spin.name) === true);
}

// ── 4. Lucky Draw keeps the REAL unowned pool ─────────────────────────────
{
  const { meta } = boot({});
  const pool = meta.poolLocked();
  check('Lucky Draw pool is the real unowned playable pool',
    Array.isArray(pool) && pool.length === CORE_SIX.length - 1 && !pool.includes('ROBOT') && pool.includes('MIRROR'),
    JSON.stringify(pool));
  check('no override widens the Lucky Draw pool', !pool.includes(FUTURE[0]), JSON.stringify(pool));
  check('visibility never fabricates ownership',
    meta.owns('MIRROR') === false && meta.owns('HUNTER') === false);
}

// ── 5. selection: ownership for players, admin session for owner testing ──
{
  const { meta } = boot({});
  check('a normal new player can select NEWBOT only',
    meta.canPublicSelect('ROBOT') === true &&
    CORE_SIX.filter((id) => id !== 'ROBOT').every((id) => meta.canPublicSelect(id) === false),
    CORE_SIX.map((id) => `${id}:${meta.canPublicSelect(id)}`).join(' '));
  check('a future visible-but-locked fighter stays locked',
    FUTURE.every((id) => meta.canPublicSelect(id) === false));
  check('the picker filter honours the single selection authority',
    meta.filterOwned([{ name: 'MIRROR' }, { name: 'SLIME' }, { name: 'ROBOT' }]).length === 1);
  check('no admin session exists by default', meta.adminTestSessionActive() === false);
}
{
  const adminWindow = { APEX_ADMIN_AUTHORITY: { isAdminTestSessionActive: () => true } };
  const { meta } = boot({}, adminWindow);
  check('an authorized Admin Test session can test-select the playable roster',
    CORE_SIX.every((id) => meta.canPublicSelect(id) === true),
    CORE_SIX.map((id) => `${id}:${meta.canPublicSelect(id)}`).join(' '));
  check('the admin session still cannot open future locked fighters',
    FUTURE.every((id) => meta.canPublicSelect(id) === false));
  check('the admin session fabricates no ownership and no credits',
    meta.owns('MIRROR') === false && meta.credits() === 350);
  check('the admin session does not widen the Lucky Draw pool',
    meta.poolLocked().length === CORE_SIX.length - 1);
}

// ── 6. match rewards: A1 table by actual mode + outcome, paid once ────────
const matchState = (mode, id) => ({ battleMode: mode, resultGold: { meta: { id } } });
{
  const { meta, storage } = boot({});
  const s1 = matchState('BOT', 'match-bot-win-1');
  const botWin = meta.awardBattleResult('P1', s1);
  check('BOT win pays +200 AC', botWin.ok === true && botWin.amount === 200 && meta.credits() === 550,
    JSON.stringify(botWin));
  check('a duplicate callback for the same match pays nothing',
    meta.awardBattleResult('P1', s1).ok === false && meta.credits() === 550);
  check('the same sealed match id under a fresh state is a duplicate claim',
    meta.awardBattleResult('P1', matchState('BOT', 'match-bot-win-1')).reason === 'duplicate-claim' &&
    meta.credits() === 550);
  const botLoss = meta.awardBattleResult('P2', matchState('BOT', 'match-bot-loss-1'));
  check('BOT loss pays the provisional +25 AC',
    botLoss.ok === true && botLoss.amount === 25 && meta.credits() === 575, JSON.stringify(botLoss));
  const localP2 = meta.awardBattleResult('P2', matchState('LOCAL', 'match-local-1'));
  check('LOCAL completion pays +50 AC when P2 wins',
    localP2.ok === true && localP2.amount === 50 && meta.credits() === 625, JSON.stringify(localP2));
  const localP1 = meta.awardBattleResult('P1', matchState('LOCAL', 'match-local-2'));
  check('LOCAL completion pays +50 AC when P1 wins (not winner-inferred)',
    localP1.ok === true && localP1.amount === 50 && meta.credits() === 675, JSON.stringify(localP1));
  check('Result telemetry reports the actual committed award and balance',
    meta.lastAward().amount === 50 && meta.lastAward().balance === 675);
  // Reload: claims persist, so a replayed result can never re-pay.
  const reloaded = boot({ [KEY]: storage.getItem(KEY) });
  check('after reload the balance and claims persist (no refill, no re-pay)',
    reloaded.meta.credits() === 675 &&
    reloaded.meta.awardBattleResult('P1', matchState('BOT', 'match-bot-win-1')).reason === 'duplicate-claim' &&
    reloaded.meta.credits() === 675);
}
{
  const { meta } = boot({});
  check('Lab matches pay 0',
    meta.awardBattleResult('P1', { battleMode: 'BOT', labMode: true, resultGold: { meta: { id: 'lab-1' } } }).ok === false &&
    meta.credits() === 350);
  check('an invalid winner pays 0',
    meta.awardBattleResult('ROBOT', matchState('BOT', 'x-1')).reason === 'invalid-winner' && meta.credits() === 350);
  check('a match without a trustworthy mode pays 0 (fail closed)',
    meta.awardBattleResult('P1', {}).reason === 'invalid-mode' && meta.credits() === 350);
  check('an abandoned/incomplete match (no sealed result, no mode) pays 0',
    meta.awardBattleResult('P1', { resultGold: null }).ok === false && meta.credits() === 350);
}
{
  const testWindow = { APEX_ARSENAL_OWNER_TEST: { active: true } };
  const { meta } = boot({}, testWindow);
  check('Admin/owner-test matches pay 0 and never touch the wallet',
    meta.awardBattleResult('P1', matchState('BOT', 'admin-1')).reason === 'admin-test' &&
    meta.credits() === 350);
}

// ── Atomic Lucky Draw save: never debit AC before ownership persists ────
{
  const {meta, storage}=boot({});
  let writes=0;
  const originalSet=storage.setItem;
  storage.setItem=(key,value)=>{writes++;originalSet(key,value)};
  const result=meta.spin(()=>0);
  const persisted=storedOf(storage);
  check('Lucky Draw stores debit and fighter entitlement in one write',
    result.ok===true && writes===1 && persisted.credits===0 &&
    persisted.ownedFighters.includes(result.name) && persisted.totalSpins===1,
    JSON.stringify({writes,result,persisted}));
}
// ── ALPHA progression law: sealed match, once-per-claim and durable AC ──
{
  const {meta, storage} = boot({});
  check('unsealed BOT cannot pay', meta.awardBattleResult('P1', {battleMode:'BOT',resultGold:null}).reason==='unsealed-match' && meta.credits()===350);
  check('mission not claimable without play', meta.claimProgressReward('first-bot').reason==='not-complete');
  const win = meta.awardBattleResult('P1', matchState('BOT','alpha-sealed-1'));
  check('sealed BOT counts exactly once', win.ok===true && meta.getState().progression.botWins===1);
  meta.awardBattleResult('P1',matchState('BOT','alpha-sealed-1'));
  check('duplicate does not increment progression',meta.getState().progression.botMatches===1);
  const first=meta.claimProgressReward('first-bot');
  check('mission pays +100 through real wallet',first.ok===true && meta.credits()===650);
  check('mission cannot pay twice',meta.claimProgressReward('first-bot').reason==='already-claimed' && meta.credits()===650);
  check('first win quest pays +150',meta.claimProgressReward('first-win').ok===true && meta.credits()===800);
  const next=boot({[KEY]:storage.getItem(KEY)});
  check('claims and AC persist after reload',next.meta.credits()===800 && next.meta.claimProgressReward('first-win').reason==='already-claimed');
  check('achievement not prematurely claimable',next.meta.claimProgressReward('bot-veteran').reason==='not-complete');
  next.meta.awardBattleResult('P1',matchState('BOT','alpha-sealed-2'));
  next.meta.awardBattleResult('P1',matchState('BOT','alpha-sealed-3'));
  check('three wins unlock only one milestone',next.meta.claimProgressReward('bot-veteran').ok===true && next.meta.claimProgressReward('bot-veteran').reason==='already-claimed');
}
// ── 7. no scattered bypasses in production sources ────────────────────────
{
  const roots = ['src', 'public'];
  const seen = [];
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'assets' || entry.name.startsWith('.')) continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(rel); continue; }
      if (!/\.(js|jsx|mjs)$/.test(entry.name)) continue;
      const text = readFileSync(path.join(ROOT, rel), 'utf8');
      if (/OWNER_PLAYTEST_CORE_SIX_UNLOCK\s*=\s*(true|false)/.test(text)) seen.push(rel);
    }
  };
  for (const r of roots) walk(r);
  check('the legacy selection switch is declared in exactly ONE file (and is false)',
    seen.length === 1 && seen[0] === 'public/game/arsenal/arsenalMetaRuntime.js' &&
    /OWNER_PLAYTEST_CORE_SIX_UNLOCK = false/.test(SOURCE),
    seen.join(','));
  check('no production source re-enables a 12,000 AC seed',
    !/OWNER_PLAYTEST_AC_SEED = 12000/.test(SOURCE) && /OWNER_PLAYTEST_AC_SEED = 0/.test(SOURCE));
  const bridge = readFileSync(path.join(ROOT, 'public/game/gold/goldProductBridge.js'), 'utf8');
  check('the Gold bridge has no second selection bypass',
    !/OWNER_PLAYTEST_CORE_SIX_UNLOCK/.test(bridge) &&
    /meta\.canPublicSelect\(hero\.productionId\)/.test(bridge));
}

const lines = ['A1 PRODUCTION PROGRESSION + ECONOMY GATE', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
process.exit(0);
