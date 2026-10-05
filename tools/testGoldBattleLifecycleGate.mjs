import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(p, 'utf8');
const bridge = read('public/game/gold/goldProductBridge.js');
const battle = read('public/game/modes/arsenalBattleRuntime.js');
const shell = read('public/gold/shell.html');
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

// Runtime-created legacy Arsenal DOM HUD appears after startMatch; recapture it.
check('legacy runtime DOM HUD ids are in the suppression set',
  /'aq-dom-hud'.*'aq-battle-exit'/s.test(bridge));
check('legacy refs are recaptured after startMatch and hidden before live paint',
  /window\.startMatch\(\);[\s\S]*?captureLegacyBattleUi\(false\);[\s\S]*?hideLegacyBattleUi\(\);/.test(bridge));

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
check('goldHosted branch hides legacy screens instead of calling goToMenu',
  !!exitBlock
  && /\['menu-screen', 'select-screen'\].*classList\.add\('hidden'\)/s.test(exitBlock[0])
  && /gameState = 'MENU'/.test(exitBlock[0]));
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

// App must not install a second hidden/blur state machine when authority exists.
check('App gates legacy music lifecycle behind missing authority',
  app.includes('const useLegacyMusicLifecycle = !musicAuthority;'));
const authorityCompat = app.match(/const musicAuthority = music \? music\.api : null;[\s\S]*?\/\/ CP7:/);
check('authority-backed App compatibility wrappers never seek currentTime=0',
  !!authorityCompat && !/currentTime\s*=\s*0/.test(authorityCompat[0]));

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

const out = ['GOLD BATTLE LIFECYCLE GATE (R46A)', ...pass];
if (fail.length) {
  out.push('', ...fail, '', 'RESULT: FAIL (' + fail.length + ')');
  console.error(out.join('\n'));
  process.exit(1);
}
out.push('', 'RESULT: PASS (' + pass.length + ' checks)');
console.log(out.join('\n'));
