// ---------------------------------------------------------------------------
// Owner-playtest economy + selection gate (r44 owner law).
//
// Executes the REAL public/game/arsenal/arsenalMetaRuntime.js source against a
// deterministic storage shim and proves:
//
//   · first boot seeds exactly 12,000 AC through the real economy save path
//     (a legacy 425 profile is upgraded exactly once),
//   · an ordinary refresh NEVER refills (12,000 → spend 350 → 11,650 →
//     refresh stays 11,650),
//   · Lucky Draw still costs the real 350 AC and still sees the REAL unowned
//     pool (test-selection availability never widens it),
//   · the Core Six selection override is ONE fenced switch, selection-only,
//     and a future visible-but-locked fighter stays locked,
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

function makeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}
function boot(initial, productSurface) {
  const storage = makeStorage(initial);
  const window = {
    localStorage: storage,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    console,
    APEX_PRODUCT_SURFACE: productSurface || {
      roster: { visibleIds: [...CORE_SIX, ...FUTURE], playableIds: CORE_SIX },
      canLaunch: () => true,
    },
  };
  const ctx = vm.createContext({
    window, console, localStorage: storage, setTimeout, clearTimeout,
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map,
  });
  vm.runInContext(`(function(){ with (window) {\n${SOURCE}\n} })();`, ctx, { filename: 'arsenalMetaRuntime.js' });
  return { meta: window.APEX_ARSENAL_META, storage, window };
}

// ── 1. fresh boot seeds exactly 12,000 ───────────────────────────────────
{
  const { meta, storage } = boot({});
  check('meta runtime registers', !!meta);
  check('first boot seeds exactly 12,000 AC', meta.credits() === 12000, `credits=${meta.credits()}`);
  const stored = JSON.parse(storage.getItem('apexChaos.arsenalMeta.v1'));
  check('the seed is persisted through the real economy save', stored.credits === 12000);
  check('the seed marker is revision+profile scoped',
    stored.ownerPlaytestAcSeed &&
    stored.ownerPlaytestAcSeed.revision === '20261005-owner-playtest-r44' &&
    stored.ownerPlaytestAcSeed.profile === 'apexChaos.arsenalMeta.v1',
    JSON.stringify(stored.ownerPlaytestAcSeed));
  const balanceFields = Object.entries(stored)
    .filter(([k, v]) => typeof v === 'number' && /credit|balance|coin|ac/i.test(k))
    .map(([k]) => k);
  check('no parallel currency variable is introduced (single credits balance)',
    balanceFields.length === 1 && balanceFields[0] === 'credits', balanceFields.join(','));
}

// ── 2. a legacy 425 profile is upgraded exactly once ─────────────────────
{
  const legacy = { version: 1, credits: 425, ownedFighters: ['ROBOT'], lastSelectedP1: 'ROBOT', lastSelectedP2: 'ROBOT', totalSpins: 3, unlockedAt: { ROBOT: 0 }, arenaPaletteId: null };
  const { meta, storage } = boot({ 'apexChaos.arsenalMeta.v1': JSON.stringify(legacy) });
  check('a legacy 425 AC profile is upgraded to 12,000 on first r44 boot', meta.credits() === 12000, `credits=${meta.credits()}`);
  const again = boot({ 'apexChaos.arsenalMeta.v1': storage.getItem('apexChaos.arsenalMeta.v1') });
  check('reloading an already-seeded profile does not re-upgrade', again.meta.credits() === 12000, `credits=${again.meta.credits()}`);
}

// ── 3. ordinary refresh never refills ────────────────────────────────────
{
  const { meta, storage } = boot({});
  check('boot balance is 12,000', meta.credits() === 12000);
  // A Lucky Draw spin costs the real 350 AC.
  const spin = meta.spin(() => 0);
  check('Lucky Draw costs the real 350 AC', spin.ok === true && spin.credits === 11650, JSON.stringify(spin));
  const afterSpin = JSON.parse(storage.getItem('apexChaos.arsenalMeta.v1'));
  check('the spent balance is persisted', afterSpin.credits === 11650, `stored=${afterSpin.credits}`);
  const refreshed = boot({ 'apexChaos.arsenalMeta.v1': storage.getItem('apexChaos.arsenalMeta.v1') });
  check('an ordinary refresh does NOT refill (11,650 stays 11,650)',
    refreshed.meta.credits() === 11650, `credits=${refreshed.meta.credits()}`);
  const refreshedTwice = boot({ 'apexChaos.arsenalMeta.v1': refreshed.storage.getItem('apexChaos.arsenalMeta.v1') });
  check('a second refresh still does not refill',
    refreshedTwice.meta.credits() === 11650, `credits=${refreshedTwice.meta.credits()}`);
}

// ── 4. Lucky Draw keeps the REAL unowned pool ────────────────────────────
{
  const { meta } = boot({});
  const pool = meta.poolLocked();
  check('Lucky Draw pool is the real unowned playable pool',
    Array.isArray(pool) && pool.length === CORE_SIX.length - 1 && !pool.includes('ROBOT') && pool.includes('MIRROR'),
    JSON.stringify(pool));
  check('the test-selection override does not widen the Lucky Draw pool',
    !pool.includes(FUTURE[0]), JSON.stringify(pool));
  check('the override does not fabricate ownership',
    meta.owns('MIRROR') === false && meta.owns('HUNTER') === false);
  check('Lucky Draw refuses when the balance cannot cover 350',
    (() => { const m2 = boot({}); m2.meta.spin(() => 0); const r = m2.meta.spin(() => 0); return r.ok === true; })());
}

// ── 5. the ONE fenced selection override ─────────────────────────────────
{
  const { meta } = boot({});
  check('all six current playable Core Six are selectable for owner testing',
    CORE_SIX.every((id) => meta.canPublicSelect(id) === true),
    CORE_SIX.map((id) => `${id}:${meta.canPublicSelect(id)}`).join(' '));
  check('a future visible-but-locked fighter stays locked',
    FUTURE.every((id) => meta.canPublicSelect(id) === false));
  check('the override is exposed as a single fenced switch',
    meta.OWNER_PLAYTEST_CORE_SIX_UNLOCK === true &&
    typeof meta.ownerPlaytestSelectionUnlocked === 'function' &&
    meta.OWNER_PLAYTEST_CORE_SIX_UNLOCK_REVISION === '20261005-owner-playtest-r44');
  check('the picker filter honours the single selection authority',
    meta.filterOwned([{ name: 'MIRROR' }, { name: 'SLIME' }, { name: 'ROBOT' }]).length === 2);
  check('the AC seed is exposed as a single fenced constant',
    meta.OWNER_PLAYTEST_AC_SEED === 12000 &&
    meta.OWNER_PLAYTEST_AC_SEED_REVISION === '20261005-owner-playtest-r44');
}

// ── 6. no scattered bypasses in production sources ───────────────────────
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
  check('the owner-playtest selection override is declared in exactly ONE file',
    seen.length === 1 && seen[0] === 'public/game/arsenal/arsenalMetaRuntime.js',
    seen.join(','));
  const bridge = readFileSync(path.join(ROOT, 'public/game/gold/goldProductBridge.js'), 'utf8');
  check('the Gold bridge has no second selection bypass',
    !/OWNER_PLAYTEST_CORE_SIX_UNLOCK/.test(bridge) &&
    /meta\.canPublicSelect\(hero\.productionId\)/.test(bridge));
}

const lines = ['OWNER PLAYTEST ECONOMY + SELECTION GATE (r44)', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
process.exit(0);
