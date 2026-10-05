// R51 scene-route policy gate.
//
// Locks the two root fixes that came out of the owner-playtest R50K cutover:
//
//   1. The Mechanical Door is a SCENE authority (boot + the Lucky Draw bay).
//      Home / Mode / Fighter Pick are screens of ONE Gold shell surface and
//      already own their authored transitions, so `setScreen()` must never run
//      a door transaction. A door route between screens is forbidden, because a
//      single failed transaction there reads to the owner as "the game froze".
//
//   2. The shell is split into several classic <script> blocks that do NOT
//      share lexical scope. Every UI cue must reach the one semantic SFX
//      authority through the published `window.apexShellSfx` seam; a bare
//      `uiSfx(...)` call in a later block throws ReferenceError inside
//      SceneTransition `commit`, which rolls the transaction back and leaves
//      Lucky Draw unable to open (the exact r50k "lucky draw is stuck" bug).
//
// It also asserts the shipping-surface guards that make this class of bug a
// build failure instead of a silent regression.
import fs from 'node:fs';

const shell = fs.readFileSync('public/gold/shell.html', 'utf8');
const battleHud = fs.readFileSync('public/gold/battle-hud.html', 'utf8');
const r50k = fs.readFileSync('tools/goldShellR50k.mjs', 'utf8');
const audit = fs.readFileSync('tools/assetAudit.mjs', 'utf8');
const prune = fs.readFileSync('tools/pruneShippingDist.mjs', 'utf8');

const failures = [];
const passes = [];
function check(name, cond) { (cond ? passes : failures).push((cond ? 'PASS ' : 'FAIL ') + name); }

// ── 1. Doorless screen router ───────────────────────────────────────────────
const setScreenStart = shell.indexOf('  async function setScreen(next){');
const setScreenEnd = shell.indexOf('  function uiFocusMove(){', setScreenStart);
const setScreen = setScreenStart >= 0 && setScreenEnd > setScreenStart
  ? shell.slice(setScreenStart, setScreenEnd)
  : '';

check('shell setScreen exists', setScreen.length > 0);
check('shell setScreen commits directly (no door transaction)', setScreen.includes('commitScreen(next)') && !setScreen.includes('tr.run({'));
check('shell setScreen still awaits real route readiness', setScreen.includes('await prepare();'));
check('shell setScreen documents the R51 route policy', setScreen.includes('R51 route policy'));

// The ONLY door routes left are the Lucky Draw scene handoffs.
check('Lucky Draw is the only door route (home->lucky)', shell.includes("name:'home->lucky'"));
check('Lucky Draw is the only door route (lucky->home)', shell.includes("name:'lucky->home'"));
check('no screen-to-screen door route survives', !shell.includes('name:`${screen}->${next}`'));

// ── 2. One cross-block SFX seam ─────────────────────────────────────────────
check('shell publishes the one cross-block SFX seam', shell.includes('window.apexShellSfx=uiSfx;'));
check('lucky draw cue uses the seam (never a block-local call)', shell.includes("window.apexShellSfx&&window.apexShellSfx('lucky.draw.enter_bay')"));

const blocks = shell.split('</script>');
let definingBlock = -1;
const bareCallsOutside = [];
blocks.forEach((block, index) => {
  if (block.includes('function uiSfx(key)')) definingBlock = index;
  const bare = (block.match(/(?<![.\w])uiSfx\(/g) || []).length;
  if (bare && index !== definingBlock) bareCallsOutside.push({ index, bare });
});
check('uiSfx is defined exactly once', blocks.filter((b) => b.includes('function uiSfx(key)')).length === 1);
check('no uiSfx call outside its own script block', bareCallsOutside.length === 0);

// ── 3. Battle HUD seam is a legitimately optional global ────────────────────
check('handoff setMode guards the teardown-optional HUD seam',
  battleHud.includes('if(window.APEX_GOLD_HUD)window.APEX_GOLD_HUD.setMode(desired);'));
check('no unguarded bare APEX_GOLD_HUD deref in the handoff bridge',
  !battleHud.includes('{\n      APEX_GOLD_HUD.setMode(desired);'));

// ── 4. Shipping-surface guards (root cause + fail-closed prune) ─────────────
check('asset audit imports the UI SFX runtime authority', audit.includes('UI_SFX_RUNTIMES'));
check('asset audit derives shell-loaded runtimes from authored HTML', audit.includes('shellRuntimeScriptPaths'));
check('prune refuses to delete HTML-referenced files', prune.includes('dist pruning removed files referenced by shipped HTML'));
const doorRouteCalls = (r50k.match(/await tr\.run\(\{/g) || []).length;
check('R50K adapter owns the doorless router', r50k.includes('R51 route policy'));
check('R50K adapter keeps only the two Lucky Draw door calls', doorRouteCalls === 2);
check('R50K adapter forbids re-introducing the screen door route',
  r50k.includes('"name:`${screen}->${next}`",'));

for (const line of passes) console.log(line);
for (const line of failures) console.error(line);
console.log(failures.length ? `\nscene-route-policy gate FAILED (${failures.length})` : `\nscene-route-policy gate PASSED (${passes.length})`);
process.exit(failures.length ? 1 : 0);
