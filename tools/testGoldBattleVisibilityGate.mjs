// ---------------------------------------------------------------------------
// Gold battle visibility gate (owner law 2026-10-05, P0 black battle screen).
//
// PROVES, with the REAL bridge source and the REAL engine helper source
// executed against a deterministic DOM shim, that:
//
//   1. the donor Gold battle HUD stays VISIBLE after the legacy battle-UI hide
//      runs (the old code hid it via a global getElementById('hud') that
//      resolved the donor because the legacy node was id-parked),
//   2. the legacy battle UI is still hidden (it must not survive beside Gold),
//   3. the live arena slot / #game-wrapper / #game-canvas are never hidden,
//   4. the engine's legacy #hud lookups can never resolve the Gold donor.
//
// No browser is required: the shim implements exactly the DOM operations the
// patched code paths use, and both the bridge and the engine helper are the
// SHIPPING sources read from disk.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

// The deterministic DOM shim + sandbox live in the shared gate library so the
// shipping sources are executed, never reimplemented.
const {
  parseSimpleHtml, makeDocument, runInWindow,
} = await import('./lib/goldDomShim.mjs');

// ── fixture: legacy production roots + Gold donor battle HUD ──────────────
function buildFixture() {
  const doc = makeDocument();
  const legacy = parseSimpleHtml(`
    <div id="battle-shell">
      <div id="p1-side-panel"><div id="p1-name">P1</div></div>
      <div id="game-wrapper">
        <div id="arena-slot-holder"></div>
        <canvas id="game-canvas"></canvas>
        <div id="countdown-overlay"><div id="countdown-num">3</div></div>
        <div id="hud"><div id="hud-health">100</div></div>
      </div>
      <div id="battle-controls"></div>
      <div id="end-screen"></div>
      <div id="combat-inspector"></div>
    </div>
  `);
  for (const c of legacy.children) doc.body.appendChild(c);

  // The Gold shell's own host, as mounted by App.jsx into #gold-shell-host.
  const shell = parseSimpleHtml(`
    <div id="gold-shell-host">
      <div id="battleHudHost" aria-hidden="true">
        <div id="hud" data-mode="battle">
          <div id="stage">
            <div id="p1Side"></div>
            <div id="p2Side"></div>
            <div id="arena"></div>
          </div>
        </div>
      </div>
    </div>
  `);
  for (const c of shell.children) doc.body.appendChild(c);
  return doc;
}
const DONOR_HTML = '<div id="hud" data-mode="battle"><div id="stage"><div id="p1Side"></div><div id="p2Side"></div><div id="arena"></div></div></div>';

// ── run the REAL bridge in the shim ───────────────────────────────────────
const failures = [];
const notes = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return true; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
  return false;
}

const document = buildFixture();
const legacyHud = document.getElementById('hud');
const gameWrapper = document.getElementById('game-wrapper');
const gameCanvas = document.getElementById('game-canvas');
const battleShell = document.getElementById('battle-shell');
const battleHudHost = document.getElementById('battleHudHost');
const countdownOverlay = document.getElementById('countdown-overlay');
const endScreen = document.getElementById('end-screen');
const battleControls = document.getElementById('battle-controls');
const p1Name = document.getElementById('p1-name');

const store = {};
const __errs = [];
// Test-only instrumentation (in memory, never on disk): expose the captured
// legacy references so the gate can prove WHICH nodes the hide touched.
const bridgeSource = read('public/game/gold/goldProductBridge.js').replace(
  '  function hideLegacyBattleUi() {',
  '  function hideLegacyBattleUi() {\n    window.__apexLegacyRefs = legacyBattleRefs.slice();');
const win = runInWindow(document, bridgeSource, 'goldProductBridge.js', {
  APEX_ARSENAL_SHELLS: {
    typeFor: (id) => ({ name: String(id).toUpperCase(), color: '#fff' }),
    ids: ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'],
    playableIds: ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR'],
    isPlayable: () => true,
  },
  APEX_ARSENAL_META: { owns: () => true, credits: () => 12000 },
  __apexEnsureDeferredRuntimes: async () => true,
  startMatch() { win.__apexStartMatchCalls = (win.__apexStartMatchCalls || 0) + 1; },
});
const APEX_GOLD = win.APEX_GOLD;

check('bridge exposes the Gold seam', !!APEX_GOLD && typeof APEX_GOLD.mountBattleHud === 'function');

// ── the donor mount (this is what shell.html launchBattleHud does) ────────
APEX_GOLD.mountBattleHud(DONOR_HTML, () => {});
const donorHud = battleHudHost.querySelector('#hud');
check('donor HUD is mounted inside the Gold host', !!donorHud);
check('legacy #hud id is parked while the donor owns #hud',
  legacyHud.getAttribute('data-apex-parked-id') === 'hud' && legacyHud.id === '');
check('a global getElementById("hud") now resolves the DONOR (ambiguity proven)',
  document.getElementById('hud') === donorHud);
check('legacyUiElement resolves the LEGACY node, not the donor',
  APEX_GOLD.legacyUiElement('hud') === legacyHud &&
  APEX_GOLD.legacyUiElement('hud') !== donorHud);

// ── the real battle-live sequence (legacy hide included) ──────────────────
win.__apexArsenalBotBattle = false;
const __origWarn = console.warn;
console.warn = (...a) => { __errs.push(a.map(String).join(' ')); };
await APEX_GOLD.onBattleLive({ mode: 'local', p1: 'newbot', p2: 'hunter' });
console.warn = __origWarn;
// The real sequence also runs the production match start; assert it happened
// exactly once (no synthetic double-trigger).
check('the real production match start was invoked exactly once',
  (win.__apexStartMatchCalls || 0) === 1, `calls=${win.__apexStartMatchCalls || 0}`);
if (__errs.length) failures.push('bridge reported an error: ' + __errs.join(' | '));
const refs = (win.__apexLegacyRefs || []).map((el) => `${el.tagName}#${el.id || '(parked:' + (el.getAttribute('data-apex-parked-id') || '') + ')'}=${JSON.stringify(el.style.display)}`);
notes.push('legacy nodes the hide touched: ' + JSON.stringify(refs));
check('no bridge error was reported during the real battle-live sequence', __errs.length === 0);

const donorDisplay = donorHud.style.display;
const donorVisible = donorDisplay !== 'none';
check('P0: the Gold donor battle HUD is NOT hidden after the legacy hide',
  donorVisible, `donor #hud display="${donorDisplay}"`);
check('P0: the Gold host itself is not hidden',
  battleHudHost.style.display !== 'none');
check('legacy #hud IS hidden (must not survive beside Gold)',
  legacyHud.style.display === 'none', `legacy #hud display="${legacyHud.style.display}"`);
check('legacy countdown/end-screen/battle-controls are hidden',
  countdownOverlay.style.display === 'none' && endScreen.style.display === 'none' && battleControls.style.display === 'none');
check('the live arena slot is not hidden',
  document.getElementById('arena').style.display !== 'none');
check('#game-wrapper is not hidden', gameWrapper.style.display !== 'none');
check('#game-canvas is not hidden', gameCanvas.style.display !== 'none');
check('the donor root subtree is untouched',
  donorHud.querySelector('#stage').style.display !== 'none');

// ── unmount restores the legacy nodes ────────────────────────────────────
APEX_GOLD.unmountBattleHud();
check('unmount restores the legacy #hud id and visibility',
  legacyHud.id === 'hud' && legacyHud.style.display !== 'none');
check('unmount removes the donor HUD from the host',
  battleHudHost.querySelector('#hud') === null || battleHudHost.querySelector('#hud') !== donorHud);

// ── the engine's legacy #hud helper (REAL source, executed) ──────────────
const vm = await import('node:vm');
const ctx = vm.createContext(new Proxy({ window: win, document, console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map, WeakMap, Symbol, DOMParser: document.DOMParser }, {
  get(target, prop) { return prop in target ? target[prop] : undefined; },
  set(target, prop, value) { target[prop] = value; return true; },
  has() { return true; },
}));
const engineSource = read('public/apexEngine.js');
const helperStart = engineSource.indexOf('function legacyUiElement(id) {');
check('engine defines legacyUiElement', helperStart >= 0);
if (helperStart >= 0) {
  const end = engineSource.indexOf('\n}', helperStart) + 2;
  const helperSource = engineSource.slice(helperStart, end);
  const engineWin = win;
  const engineRunner = vm.runInContext(
    `(function(window){ with (window) { ${helperSource}\n return { legacyUiElement }; } })`,
    ctx, { filename: 'apexEngine.legacyUiElement.js' });
  const engineApi = engineRunner(engineWin);
  check('engine legacyUiElement resolves the LEGACY hud (not the donor)',
    engineApi.legacyUiElement('hud') === legacyHud);
  // re-mount and prove it still resolves legacy while the donor owns #hud
  APEX_GOLD.mountBattleHud(DONOR_HTML, () => {});
  const during = engineApi.legacyUiElement('hud');
  check('engine legacyUiElement never resolves the donor during a Gold battle',
    during === legacyHud && during !== donorHud,
    `resolved=${during ? during.id || '(parked legacy)' : 'null'}`);
  APEX_GOLD.unmountBattleHud();
  const engineCode = engineSource.replace(/^\s*\/\/.*$/gm, '');
  const residual = engineCode.match(/getElementById\(['"]hud['"]\)/g) || [];
  check('no global getElementById("hud") remains in the engine production paths',
    residual.length === 0, `residual=${residual.length}`);
}

// ── report ───────────────────────────────────────────────────────────────
const lines = [
  'GOLD BATTLE VISIBILITY GATE (owner law 2026-10-05, P0 black battle screen)',
  ...notes,
];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
process.exit(0);
