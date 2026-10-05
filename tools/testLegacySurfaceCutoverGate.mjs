import fs from 'node:fs';

const app=fs.readFileSync('src/App.jsx','utf8');
const manifest=fs.readFileSync('src/game/runtimeManifest.js','utf8');
const shell=fs.readFileSync('public/gold/shell.html','utf8');
const build=fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const shellAdapter=fs.readFileSync('tools/goldShellR50k.mjs','utf8');
const meta=fs.readFileSync('public/game/arsenal/arsenalMetaRuntime.js','utf8');
const engine=fs.readFileSync('public/apexEngine.js','utf8');
const battle=fs.readFileSync('public/game/modes/arsenalBattleRuntime.js','utf8');
const music=fs.readFileSync('public/game/product/productMusicAuthority.js','utf8');
const select=fs.readFileSync('public/game/arsenal/arsenalShellSelectRuntime.js','utf8');
const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('React legacy menu DOM removed', !app.includes('id="menu-screen"'));
check('React legacy picker DOM removed', !app.includes('id="select-screen"') && !app.includes('apex-pick-runtime-root'));
check('old loading-screen DOM removed', !app.includes('id="loading-screen"'));
check('boot starts from blackout + Gold transition canvas', app.includes('id="apex-boot-blackout"') && app.includes('id="apex-scene-transition"'));
check('App installs one scene transition coordinator', app.includes("installSceneTransitionCoordinator") && app.includes("window.APEX_SCENE_TRANSITION"));

check('engine canvas infrastructure retained', app.includes('id="game-canvas"') && app.includes('id="game-wrapper"'));
check('battle infrastructure retained', app.includes('id="battle-shell"') && app.includes('CombatPanelSide side={1}') && app.includes('CombatPanelSide side={2}'));
check('legacy picker source deleted', !fs.existsSync('public/game/ui/apexPickRuntime.js'));
check('production runtime graph has no old picker', !manifest.includes('apexPickRuntime.js'));
check('production deferred groups have no select group', !manifest.includes("select: SELECT_RUNTIMES"));

check('Gold shell exposes canonical navigator', shell.includes('window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell'));
check('Gold shell queues pre-mount navigation once', shell.includes('window.__apexPendingGoldNavigation') && shell.includes('delete window.__apexPendingGoldNavigation'));
check('generator owns canonical navigator patch', build.includes('R50J (shell): canonical Gold navigation authority exposed'));
check('generator owns Mechanical Door shell adapter', build.includes('adaptGoldShellR50k(out)') && shellAdapter.includes('Mechanical Door V4'));

check('meta fighter pick routes to Gold', meta.includes("requestGoldNavigation('fighter', { mode })") && !meta.includes("ensure('select')"));
check('meta menu return routes to Gold', meta.includes("requestGoldNavigation('home')") && !meta.includes("typeof goToMenu === 'function'"));
check('shell selection never calls old goToSelect', !select.includes('goToSelect()') && select.includes("requestGoldNavigation('fighter', { mode })"));
check('engine goToMenu compatibility is replaced by Gold route once hub loads', select.includes("window.goToMenu = function goToProductMenu()") && select.includes("requestGoldNavigation('home')"));
check('App no longer exports engine goToSelect', !app.includes('window.goToSelect = goToSelect'));
check('Gold bridge no longer expects menu/select DOM', !bridge.includes("for (const id of ['menu-screen', 'select-screen'])") && !bridge.includes("'menu-screen', 'select-screen'"));

// ── R52: the DELETION law (not just suppression) ─────────────────────────
// The retired product screens are deleted everywhere, so no shipping source may
// still query, hide or paint their ids, and the dead pick/preview code that
// existed only to fill them is gone. Every check below is about *live* bytes in
// the shipping sources, not comments.
check('engine keeps no reference to a retired product screen',
  !/menu-screen|select-screen/.test(engine));
check('engine no longer defines the retired screen helper',
  !engine.includes('function setProductScreenHidden('));
check('dead legacy pick/preview renderer deleted (picker is the Gold picker)',
  !engine.includes('function drawRosterPreview(')
  && !engine.includes('function renderRosterPreviews(')
  && !engine.includes('function populateRoster(')
  && !engine.includes('function selectFighter(')
  && !engine.includes('function ensureRosterPreviewLoop(')
  && !engine.includes('rosterPreviewRaf'));
check('engine goToSelect routes to the ONE Gold navigator',
  /window\.APEX_GOLD_SHELL_NAVIGATE/.test(engine)
  && /navigate\('fighter'\)/.test(engine)
  && !engine.includes('roster-grid'));
check('battle runtime keeps no reference to a retired product screen',
  !/menu-screen|select-screen/.test(battle));
check('music authority reads a live surface, never a retired screen id',
  !/menu-screen|select-screen/.test(music)
  && /screen-\(\[a-z\]\+\)/.test(music)
  && /allowed\.has\(goldScreen\(\)\)/.test(music));
check('App keeps no retired legacy music identifiers',
  !app.includes('menuMusicAllowed') && !app.includes('useLegacyMusicLifecycle'));

check('old bespoke Battle transition DOM removed', !shell.includes('id="battleTransition"') && !shell.includes('#battleTransition'));
check('Mechanical Door is the sole public transition route', shell.includes('window.APEX_SCENE_TRANSITION') && !shell.includes('phase-lock') && !shell.includes('phase-clamp'));

console.log(['LEGACY SURFACE CUTOVER GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
