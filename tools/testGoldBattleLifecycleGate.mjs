import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(p, 'utf8');
const bridge = read('public/game/gold/goldProductBridge.js');
const battle = read('public/game/modes/arsenalBattleRuntime.js');
const selectRuntime = read('public/game/arsenal/arsenalShellSelectRuntime.js');
const shell = read('public/gold/shell.html');
const hud = read('public/gold/battle-hud.html');
const generator = read('tools/buildGoldCutover.mjs');
const app = read('src/App.jsx');
const musicSource = read('public/game/product/productMusicAuthority.js');

const pass = [];
const fail = [];
function check(name, ok, detail = '') {
  (ok ? pass : fail).push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}

// Battle donor CSS must be mounted, but never leak globally.
check('battle bridge imports donor head CSS into a scoped style',
  bridge.includes("style.setAttribute('data-apex-gold-hud-style', 'true')")
  && bridge.includes("return '@scope (#battleHudHost){\\n' + scopedRules"));
check('donor :root and html/body are localized to the HUD scope root',
  bridge.includes(".replace(/:root\\b/g, ':scope')")
  && bridge.includes(".replace(/html\\s*,\\s*body/g, ':scope')"));
check('donor keyframes are preserved outside @scope',
  bridge.includes('function extractKeyframeBlocks(cssText)'));

// Remount must not keep closures bound to removed donor DOM.
check('battle HUD seam is cleared on mount/unmount',
  (bridge.match(/delete window\.APEX_GOLD_HUD/g) || []).length >= 2);

// Deferred-loading cancellation: ESC/exit while arsenalProduct is still loading
// must invalidate that async continuation before it can start the engine.
check('battle bridge owns a monotonic deferred-launch session token',
  /let battleSessionToken = 0;/.test(bridge)
  && /const sessionToken = \+\+battleSessionToken;/.test(bridge));
check('deferred battle launch rechecks token + mount state after await',
  /const loaded = await ensureDeferredRuntimes\('arsenalProduct'\);/.test(bridge)
  && /sessionToken !== battleSessionToken/.test(bridge)
  && /!hudMounted \|\| !battleLiveRunning/.test(bridge));
check('exit and unmount invalidate deferred battle launches',
  (bridge.match(/battleSessionToken \+= 1;/g) || []).length >= 2);

// The bridge projection pump must die with the donor; no invisible background
// RAF chain is allowed after returning to Fighter Pick.
check('bridge projection pump self-stops when donor is unmounted',
  /if \(!hudMounted\) \{ pumpId = 0; return; \}/.test(bridge));
check('bridge cancels projection RAF during explicit teardown',
  (bridge.match(/cancelAnimationFrame\(pumpId\)/g) || []).length >= 2);

// Donor remount law: one recursive RAF + one initial boot; Escape handler must
// resolve the CURRENT host rather than close over the first mount's script node.
check('Gold Battle HUD has exactly one pump boot plus its recursive RAF',
  (hud.match(/requestAnimationFrame\(frame\);/g) || []).length === 2,
  'count=' + ((hud.match(/requestAnimationFrame\(frame\);/g) || []).length));
check('Gold Battle HUD frame pump stops when its stage is disconnected',
  /if\(!R\.stage\|\|!R\.stage\.isConnected\)return;/.test(hud));
check('Escape handler follows the current open Battle host across remounts',
  /const host=document\.getElementById\('battleHudHost'\);/.test(hud)
  && /host\.classList\.contains\('is-open'\)/.test(hud)
  && !/const exitRoot=document\.currentScript/.test(hud));

// Music surfaces have ONE caller: the shell. Bridge may forward generic
// BRIDGE.onSurface(surfaceId), but may not independently force battle beats.
check('bridge does not independently force transition/battle music surfaces',
  !/theme\.setSurface\('transition'\)/.test(bridge)
  && !/theme\.setSurface\('battle'\)/.test(bridge));

// Generator anti-drift: SHL-S26 must target the exact renderWorldHero block.
// The previous broad regex matched renderArt() first and would corrupt the next
// generated shell even while the checked-in shell looked healthy.
check('generator SHL-S26 uses an exact function-local world-stage needle',
  /id: 'SHL-S26'[\s\S]*?find: \(src\) => \{[\s\S]*?body\.appendChild\(clone\);/.test(generator)
  && !/id: 'SHL-S26'[\s\S]*?find: \/    if\\\(id==='newbot'/.test(generator));
check('generator carries remount-safe donor RAF and Escape laws',
  /if\(!R\.stage\|\|!R\.stage\.isConnected\)return;/.test(generator)
  && /const host=document\.getElementById\('battleHudHost'\)/.test(generator));


// Runtime-created legacy Arsenal DOM HUD appears after startMatch; recapture it.
check('legacy runtime DOM HUD ids are in the suppression set',
  /'aq-dom-hud'.*'aq-battle-exit'/s.test(bridge));
check('legacy refs are recaptured only after awaited production match READY and hidden before live paint',
  /const started = await Promise\.resolve\(window\.startMatch\(\)\);[\s\S]*?started !== true[\s\S]*?captureLegacyBattleUi\(false\);[\s\S]*?hideLegacyBattleUi\(\);/.test(bridge));

check('Gold-hosted Arsenal DOM HUD is suppressed at source even if match launch is async',
  /window\.__apexGoldBattleHosted === true\) el\.style\.display = 'none'/.test(battle));
check('Arsenal DOM HUD is disposed and refs reset on battle exit',
  /function disposeArsenalDomHud\(\)/.test(battle)
  && /disposeArsenalDomHud\(\);/.test(battle));

check('Gold battle relocates ONLY the gameplay canvas, never the legacy game-wrapper tree',
  /arena\.appendChild\(canvas\)/.test(bridge)
  && !/arena\.appendChild\(wrap\)/.test(bridge)
  && /Move ONLY the 1000×1000 gameplay canvas/.test(bridge));

check('legacy product menu/select suppression runs before deferred battle loading and again before live paint',
  /function hideLegacyProductScreens\(\)/.test(bridge)
  && bridge.indexOf('hideLegacyProductScreens();') < bridge.indexOf("await ensureDeferredRuntimes('arsenalProduct')")
  && (bridge.match(/hideLegacyProductScreens\(\);/g) || []).length >= 3);
check('legacy product screens are deleted from the shipped surface, not merely suppressed',
  !/id="(menu|select)-screen"/.test(read('index.html'))
  && !/id="(menu|select)-screen"/.test(shell));

check('cold-load handoff writes selection/pending state only AFTER arsenalProduct runtime exists',
  bridge.indexOf("const loaded = await ensureDeferredRuntimes('arsenalProduct');")
    < bridge.indexOf('window.__apexArsenalSelectPending = true;')
  && /const shells = window\.APEX_ARSENAL_SHELLS;[\s\S]*?const p1Type = shells\.typeFor\(p1\);[\s\S]*?window\.p1Selection = p1Type;/.test(bridge));

check('Gold-hosted select runtime never resurrects the legacy picker on failure',
  /const goldHosted = window\.__apexGoldBattleHosted === true;/.test(selectRuntime)
  && /if \(!goldHosted\) beginSelection/.test(selectRuntime));

check('select runtime exposes a Promise<boolean> READY contract for every match-start branch',
  /window\.startMatch = function startProductBattle/.test(selectRuntime)
  && /return Promise\.resolve\(false\)/.test(selectRuntime)
  && /return Promise\.resolve\(launch\(\)\)/.test(selectRuntime)
  && /\.then\(\(ready\) => ready \? launch\(\) : false\)/.test(selectRuntime));

check('Gold shell awaits production READY before battle-hud-open',
  /async function setBattleLive\(\)/.test(shell)
  && /const liveReady=await setBattleLive\(\);/.test(shell)
  && /if\(liveReady!==true\)/.test(shell)
  && shell.indexOf('const liveReady=await setBattleLive();') < shell.indexOf("document.body.classList.add('battle-hud-open')"));

check('battle handoff messages are preview-only after production becomes live',
  /if\(!battleHudConfig\|\|battleHudConfig\.live===true\|\|!battleHudFrame\?\.contentWindow\)return;/.test(shell));

const liveBlock = shell.match(/async function setBattleLive\(\)\{[\s\S]*?\n  \}/);
check('production READY frame cannot be overwritten by a later donor handoff',
  !!liveBlock
  && !/sendBattleHudConfig\(\);/.test(liveBlock[0])
  && /Production projection is now authoritative/.test(liveBlock[0]));

// Gold owns the destination; engine owns teardown only.
check('Gold bridge exposes one engine teardown seam',
  /BRIDGE\.exitBattle = function exitBattle\(\)/.test(bridge)
  && /exitArsenalBattleMode\(\{ goldHosted: true, silentGoldExit: true \}\)/.test(bridge));
const resultReturn = bridge.match(/function scheduleResultReturn\(\)[\s\S]*?function cancelResultReturn/);
check('result return posts one shell exit event and does not directly open/exit legacy flow',
  !!resultReturn
  && !/exitArsenalBattleMode/.test(resultReturn[0])
  && /APEX_CHAOS_BATTLE_EXIT/.test(resultReturn[0]));

const exitBlock = battle.match(/window\.exitArsenalBattleMode = function exitArsenalBattleMode\(options = \{\}\)[\s\S]*?\n  \};/);
check('battle runtime has explicit goldHosted teardown-only branch', !!exitBlock && /if \(goldHosted\)/.test(exitBlock[0]));
// OWNER LAW (R52): the retired menu/select ids are deleted from the product,
// so the goldHosted branch is engine teardown ONLY — it must not paint, hide or
// reference a screen that no longer exists, and it must not open the legacy
// product menu. It announces the exit to the Gold shell instead.
const goldBranch = exitBlock ? exitBlock[0].match(/if \(goldHosted\) \{[\s\S]*?return true;/) : null;
check('goldHosted branch is teardown-only and never touches a retired screen',
  !!goldBranch
  && /gameState = 'MENU'/.test(goldBranch[0])
  && !/goToMenu/.test(goldBranch[0])
  && !/menu-screen/.test(goldBranch[0])
  && !/select-screen/.test(goldBranch[0])
  && /APEX_CHAOS_BATTLE_EXIT/.test(goldBranch[0]));
// The non-Gold fallback keeps its historical destination (goToMenu), which the
// retired-screen deletion must not have removed.
check('non-Gold fallback still uses the one legacy menu entry point',
  !!exitBlock && /goToMenu\(\);/.test(exitBlock[0]));
check('legacy music resume no longer restarts at zero',
  !!exitBlock && /apexPlayMenuMusic\?\.\(false\)/.test(exitBlock[0])
  && !/apexPlayMenuMusic\?\.\(true\)/.test(exitBlock[0]));

// Shell must drive the product surface state.
for (const surface of ['home', 'transition', 'battle', 'fighter', 'lucky']) {
  check('shell announces music surface: ' + surface,
    shell.includes("APEX_GOLD.onSurface&&APEX_GOLD.onSurface('" + surface + "')"));
}
const closeBlock = shell.match(/function closeBattleHud\(\)[\s\S]*?\n  \}/);
check('Gold shell tears engine down before unmounting live battle',
  !!closeBlock && /APEX_GOLD\.exitBattle&&APEX_GOLD\.exitBattle\(\)/.test(closeBlock[0])
  && closeBlock[0].indexOf('APEX_GOLD.exitBattle') < closeBlock[0].indexOf('APEX_GOLD.unmountBattleHud'));
check('bridge unmount no longer independently stops theme music', !/theme\.stop\(\);/.test(bridge));

// OWNER LAW (R52): the App must not install a second hidden/blur state machine
// at all. The product music authority is the ONE owner of autoplay unlock and
// of the visible/hidden lifecycle; the old legacy mirror (and the deleted
// `menuMusicAllowed()` identifier it called) is gone, not re-gated.
check('App installs exactly ONE music lifecycle (no legacy mirror)',
  !app.includes('useLegacyMusicLifecycle')
  && !app.includes('menuMusicAllowed')
  && !/addEventListener\('visibilitychange'/.test(app)
  && !/addEventListener\('blur'/.test(app)
  && !/addEventListener\('focus'/.test(app)
  && /window\.apexProductMusic = musicAuthority;/.test(app));
const authorityCompat = app.match(/const musicAuthority = music \? music\.api : null;[\s\S]*?const launchProductSurface = /);
check('the authority-backed compatibility wrappers never seek currentTime=0',
  !!authorityCompat && !/currentTime\s*=\s*0/.test(authorityCompat[0])
  && !/currentTime\s*=\s*0/.test(app));

// R52 fewer forced steps: a backdrop tap leaves the Free Battle step, but only
// through the ONE navigation route the keyboard already uses (back() /
// closeBattleHud()) — a tap never invents a destination, and it can never fire
// on an interactive element, during the Door/flow transition, while the Lucky
// donor is open, or mid-match (the result flag gates the battle case).
check('Free Battle backdrop tap exits one step through the ONE route',
  shell.includes('let tapOutsideStart=null;')
  && shell.includes("if(screen==='mode'||screen==='fighter'){back();return;}")
  && shell.includes("if(screen==='battle'&&document.body.classList.contains('battle-result'))void closeBattleHud();")
  && shell.includes("el.closest('button,a,input,select,textarea,label,[role=\"button\"],[data-arsenal-act],.cta,.modeCard,.rosterCard,.lockIn,.skill,.weapon,.wp-swap,.wp-ico')")
  && shell.includes("if(stage.classList.contains('flow-transition'))return;")
  && shell.includes("if(held>420)return;")
  && shell.includes('e.timeStamp>=start.ts'));
// R52 no-swallowed-steps law: while the Door owns the screen, a doorless step
// intent is queued (latest wins) and drained when the Door settles - a pressed
// card must always land, and the route guard must not drop on Door state.
check('a doorless step is queued, never swallowed, while the Door owns the screen',
  shell.includes('let queuedScreen=null, queuedScreenTimer=0;')
  && shell.includes('return queueScreen(next);')
  && shell.includes('queuedScreenTimer=setTimeout(drainQueuedScreen,120);')
  && shell.includes("if(screen==='transition'||screen==='battle')return false;")
  && !shell.includes("screen==='battle'||window.APEX_SCENE_TRANSITION?.active?.())return false;"));

check('the result stamp publishes ONE body flag that gates the post-match tap',
  bridge.includes("document.body.classList.add('battle-result')")
  && bridge.includes("document.body.classList.remove('battle-result')"));

// Execute the shipping music authority to prove blur+hidden cannot overwrite
// the resume latch and battle->fighter preserves the same playhead.
const winListeners = new Map();
const docListeners = new Map();
const add = (map, type, fn) => {
  if (!map.has(type)) map.set(type, new Set());
  map.get(type).add(fn);
};
const remove = (map, type, fn) => map.get(type)?.delete(fn);
const fire = (map, type, ev = {}) => {
  for (const fn of [...(map.get(type) || [])]) fn(ev);
};

let now = 0;
class FakeAudio {
  constructor() {
    this.paused = true;
    this.currentTime = 37;
    this.volume = 0.48;
    this.muted = false;
    this.loop = false;
    this.preload = '';
    this.src = '';
    this.currentSrc = '';
    this.readyState = 4;
    this.networkState = 1;
  }
  load() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const doc = {
  hidden: false,
  getElementById: () => null,
  addEventListener(type, fn) { add(docListeners, type, fn); },
  removeEventListener(type, fn) { remove(docListeners, type, fn); },
};
const win = {
  Audio: FakeAudio,
  document: doc,
  performance: { now: () => now },
  requestAnimationFrame(fn) { return setTimeout(() => { now += 400; fn(); }, 0); },
  cancelAnimationFrame(id) { clearTimeout(id); },
  getComputedStyle: () => ({ display: 'none', visibility: 'hidden', opacity: '0' }),
  addEventListener(type, fn) { add(winListeners, type, fn); },
  removeEventListener(type, fn) { remove(winListeners, type, fn); },
};
const sandbox = {
  window: win, document: doc, console,
  setTimeout, clearTimeout, Promise, Date, Math, JSON, Object, Array, String,
  Number, Boolean, RegExp, Error, module: { exports: {} },
};
sandbox.globalThis = sandbox;
vm.runInContext(musicSource, vm.createContext(sandbox), { filename: 'productMusicAuthority.js' });
const authority = win.apexProductMusic;
const audio = win.__apexProductMusicHandle?.audio;
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  }
};

if (authority && audio) {
  authority.setSurface('home');
  await flush();
  audio.currentTime = 37;
  check('Home surface starts the one theme element', audio.paused === false);

  fire(winListeners, 'blur', { type: 'blur' });
  doc.hidden = true;
  fire(docListeners, 'visibilitychange', { type: 'visibilitychange' });
  check('blur+hidden pauses music once without losing resume intent', audio.paused === true);

  doc.hidden = false;
  fire(docListeners, 'visibilitychange', { type: 'visibilitychange' });
  check('visible alone does not resume while blur reason remains', audio.paused === true);

  fire(winListeners, 'focus', { type: 'focus' });
  await flush();
  check('focus after visible resumes from the same playhead',
    audio.paused === false && audio.currentTime === 37,
    'paused=' + audio.paused + ' currentTime=' + audio.currentTime);

  authority.setSurface('battle');
  await flush();
  check('battle surface is music-off and preserves playhead',
    audio.paused === true && audio.currentTime === 37,
    'paused=' + audio.paused + ' currentTime=' + audio.currentTime);

  authority.setSurface('fighter');
  await flush();
  check('fighter resumes the same element without reset',
    audio.paused === false && audio.currentTime === 37,
    'paused=' + audio.paused + ' currentTime=' + audio.currentTime);
} else {
  check('shipping product music authority installs in harness', false);
}

const out = ['GOLD BATTLE LIFECYCLE GATE (R49D root ownership)', ...pass];
if (fail.length) {
  out.push('', ...fail, '', 'RESULT: FAIL (' + fail.length + ')');
  console.error(out.join('\n'));
  process.exit(1);
}
out.push('', 'RESULT: PASS (' + pass.length + ' checks)');
console.log(out.join('\n'));
