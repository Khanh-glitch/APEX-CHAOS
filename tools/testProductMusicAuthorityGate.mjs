// ---------------------------------------------------------------------------
// Forward Drive music authority gate (owner law 2026-10-05, finding 6).
//
// Executes the SHIPPING productMusicAuthority.js against a fake HTMLMediaElement
// and a fake window, and proves:
//
//   * exactly ONE product music element exists, sourced from the Forward Drive
//     theme — no second Audio, no second music AudioContext,
//   * the boot runtime is requested independently of apexEngine and playback
//     is requested on the initial transition surface,
//   * a blocked autoplay is recorded HONESTLY (never faked as playing) and the
//     playhead is never reset because of the block,
//   * ONE temporary gesture-unlock set is armed on
//     pointerdown/touchstart/keydown/click, resumes the SAME element on the
//     first legal gesture, and is removed after success,
//   * M mutes MUSIC only,
//   * no-spam diagnostics are published.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(path.join(ROOT, 'public/game/product/productMusicAuthority.js'), 'utf8');
const APP_SOURCE = readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
const MANIFEST_SOURCE = readFileSync(path.join(ROOT, 'src/game/runtimeManifest.js'), 'utf8');
const LOADER_SOURCE = readFileSync(path.join(ROOT, 'src/game/runtimeLoader.js'), 'utf8');

const notes = [];
const failures = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return true; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
  return false;
}

// ── E1 boot sequencing: music must not wait for apexEngine / Gold Home ───────
check('product music has its own boot runtime group',
  /PRODUCT_MUSIC_BOOT_RUNTIMES\s*=\s*\[/.test(MANIFEST_SOURCE)
  && /\.\.\.PRODUCT_MUSIC_BOOT_RUNTIMES/.test(MANIFEST_SOURCE));
check('runtime loader exposes the boot-only music load',
  /export function loadProductMusicBootRuntime\(\)/.test(LOADER_SOURCE)
  && /loadRuntimeList\(PRODUCT_MUSIC_BOOT_RUNTIMES\)/.test(LOADER_SOURCE));
const bootLoadAt = APP_SOURCE.indexOf('await loadProductMusicBootRuntime()');
const bootSurfaceAt = APP_SOURCE.indexOf("musicAuthority.setSurface?.('transition')");
const goldMountAt = APP_SOURCE.indexOf('const mountGoldShell = async');
check('App requests the music authority before publishing the initial transition surface',
  bootLoadAt >= 0 && bootSurfaceAt > bootLoadAt,
  `load=${bootLoadAt} surface=${bootSurfaceAt}`);
check('boot theme request is independent of Gold Home mount',
  bootSurfaceAt >= 0 && goldMountAt > bootSurfaceAt,
  `surface=${bootSurfaceAt} goldMount=${goldMountAt}`);
check('boot music no longer claims Home as the initial request surface',
  !/musicAuthority\.setSurface\?\.\('home'\)/.test(APP_SOURCE));

const listeners = new Map();
class FakeAudio {
  constructor(src) {
    this.src = src || '';
    this.loop = false;
    this.preload = '';
    this.volume = 1;
    this.muted = false;
    this.paused = true;
    this.currentTime = 0;
    this.__apexMenuMusic = false;
    this.playCalls = 0;
    this.currentSrc = '';
  }
  load() {}
  play() {
    this.playCalls += 1;
    FakeAudio.playAttempts += 1;
    if (FakeAudio.blocked) {
      const err = new Error('play() rejected');
      err.name = 'NotAllowedError';
      return Promise.reject(err);
    }
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}
FakeAudio.playAttempts = 0;
FakeAudio.blocked = true; // default: the browser blocks autoplay

const doc = {
  hidden: false,
  getElementById: () => null,
  addEventListener() {}, removeEventListener() {},
};
const win = {
  Audio: FakeAudio,
  document: doc,
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  },
  removeEventListener(type, fn) {
    if (listeners.has(type)) listeners.get(type).delete(fn);
  },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: () => {},
  performance: { now: () => Date.now() },
  getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
};

// Execute the SHIPPING authority in a sandbox whose global scope IS our fake
// window, so `new win.Audio()` and `window.apexProductMusic` behave as in a
// browser without a browser.
const vm = await import('node:vm');
const sandbox = {
  window: win, document: doc, console,
  setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, Math, JSON,
  Object, Array, String, Number, Boolean, RegExp, Error, module: { exports: {} },
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(SOURCE, ctx, { filename: 'productMusicAuthority.js' });
const authority = win.apexProductMusic;
const moduleExports = sandbox.module.exports;
check('the shipping module also exports its CommonJS surface',
  !!moduleExports && moduleExports.SOURCE === '/assets/audio/forward_drive_theme.ogg');

check('the ONE product music authority is installed', !!authority && typeof authority.state === 'function');
check('the music source is the Forward Drive theme',
  authority && authority.state().src === '/assets/audio/forward_drive_theme.ogg',
  authority ? authority.state().src : 'none');

const created = [];
const OrigAudio = win.Audio;
win.Audio = class extends OrigAudio { constructor(...a) { super(...a); created.push(this); } };
const again = win.installProductMusicAuthority({ window: win, document: doc });
check('a second install returns the SAME authority (no second element)',
  again && again.api === authority && created.length === 0, `created=${created.length}`);
check('exactly one product-music element exists', authority.elementCount() === 1);
win.Audio = OrigAudio;

// ── the ONE temporary gesture-unlock set ─────────────────────────────────
// The authority also installs its own permanent M-mute (keydown) and
// hidden/blur pause handlers; identify the UNLOCK set by identity instead of
// by raw listener count. The baseline snapshot is taken BEFORE any playback is
// requested, so only the unlock set is "added".
const armedTypes = ['pointerdown', 'touchstart', 'keydown', 'click'];
const snapshot = () => {
  const out = {};
  for (const t of armedTypes) out[t] = [...(listeners.get(t) || [])];
  return out;
};
const beforeArm = snapshot();
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

// ── Initial transition boot requests playback ─────────────────────────────
const before = authority.diagnostics();
authority.setSurface('transition');
await flush();
const afterBootTransition = authority.diagnostics();
check('initial transition requests playback', afterBootTransition.requested > before.requested, `requested=${afterBootTransition.requested}`);
check('a blocked autoplay is recorded HONESTLY (blocked=true, not faked)',
  afterBootTransition.blocked === true && afterBootTransition.rejected > 0,
  JSON.stringify({ blocked: afterBootTransition.blocked, rejected: afterBootTransition.rejected }));
check('the blocked state is visible in the public state()',
  authority.state().blocked === true && authority.state().paused === true
  && authority.state().surface?.id === 'transition');
const addedUnlock = snapshot();
for (const t of armedTypes) addedUnlock[t] = addedUnlock[t].filter((fn) => !beforeArm[t].includes(fn));
check('ONE temporary gesture-unlock set is armed on all four gesture types',
  armedTypes.every((t) => addedUnlock[t].length === 1),
  armedTypes.map((t) => addedUnlock[t].length).join(','));

check('ONE temporary gesture-unlock set is armed on all four gesture types',
  armedTypes.every((t) => addedUnlock[t].length === 1),
  armedTypes.map((t) => addedUnlock[t].length).join(','));

// ── resume the SAME element on the first legal gesture, then remove ──────
const element = win.__apexProductMusicHandle.audio;
FakeAudio.blocked = false; // the user gesture unlocks playback
element.currentTime = 42; // a real playhead the browser must not reset
const unlocker = addedUnlock.pointerdown[0];
check('an unlocker is actually registered', typeof unlocker === 'function');
unlocker({ type: 'pointerdown' });
await flush();
const unlockedDiag = authority.diagnostics();
check('the first legal gesture unlocks playback', unlockedDiag.unlocked === 1, `unlocked=${unlockedDiag.unlocked}`);
check('the SAME element is playing (no second element)', element.paused === false);
check('currentTime is NOT reset because autoplay was blocked',
  element.currentTime === 42, `currentTime=${element.currentTime}`);
const afterArm = snapshot();
const stillAdded = armedTypes.map((t) => afterArm[t].filter((fn) => !beforeArm[t].includes(fn)).length);
check('the gesture listeners are REMOVED after success',
  stillAdded.every((c) => c === 0), stillAdded.join(','));
check('the blocked state clears after a successful unlock',
  authority.diagnostics().blocked === false && authority.state().paused === false);

const playheadBeforeHome = element.currentTime;
authority.setSurface('home');
await flush();
check('transition -> Home keeps the SAME element and preserved playhead',
  win.__apexProductMusicHandle.audio === element
  && authority.state().paused === false
  && element.currentTime >= playheadBeforeHome,
  `before=${playheadBeforeHome} after=${element.currentTime}`);


// ── no-spam diagnostics ──────────────────────────────────────────────────
const d = authority.diagnostics();
check('diagnostics publish requested/success/rejected/armed/unlocked counters',
  ['requested', 'success', 'rejected', 'armed', 'unlocked'].every((k) => typeof d[k] === 'number'),
  Object.keys(d).join(','));
check('diagnostics publish currentTime before/after the unlock',
  typeof d.lastCurrentTimeBefore === 'number' && typeof d.lastCurrentTimeAfter === 'number');
check('diagnostics publish surface, muted and the listener count',
  'surface' in d && 'muted' in d && typeof d.gestureListenerCount === 'number');
check('diagnostics are read-only (repeated reads do not inflate counters)',
  (() => { const a = authority.diagnostics().requested; authority.diagnostics(); return authority.diagnostics().requested === a; })());

// ── M mutes MUSIC only ───────────────────────────────────────────────────
await flush();
const mutedNow = authority.toggleMute();
check('M toggles the music mute on the ONE element', mutedNow === true && element.muted === true);
check('M is exposed as the global music mute flag',
  win.__apexGoldMusicMuted === true);
check('toggling back restores audible music', authority.toggleMute() === false && element.muted === false);

// ── surface policy ───────────────────────────────────────────────────────
authority.setSurface('lucky');
await flush();
check('Lucky Draw is music-off', authority.state().allowed === false);
authority.setSurface('transition');
await flush();
check('the battle-entry transition keeps the theme playing', authority.state().allowed === true);

// ── no second music AudioContext / element anywhere in the product ───────
const roots = ['src', 'public'];
let audioCreations = 0;
let musicContexts = 0;
const walk = (dir) => {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'assets' || entry.name.startsWith('.')) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    const text = readFileSync(path.join(ROOT, rel), 'utf8');
    for (const line of text.split('\n')) {
      if (/^\s*\/\//.test(line)) continue;
      // The ONE semantic UI-SFX authority (uiSfxAuthority.js) legitimately owns
      // its own cached cue elements; it is not a music source. Owner law keeps
      // UI SFX and MUSIC as separate authorities.
      if (/new\s+(win\.)?Audio\(/.test(line) && !/productMusicAuthority/.test(rel)
        && !/uiSfxAuthority/.test(rel)) audioCreations += 1;
      if (/new\s+(window\.)?(AudioContext|webkitAudioContext)\(/.test(line) && !/productMusicAuthority/.test(rel)) musicContexts += 1;
    }
  }
};
for (const r of roots) walk(r);
// Muted, never-played prefetch warmers (__apexAudioWarmOnly) are not music
// elements: they never play audible audio and are not a second music source.
const warmOnly = [];
const walkWarm = (dir) => {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'assets' || entry.name.startsWith('.')) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkWarm(rel); continue; }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    const text = readFileSync(path.join(ROOT, rel), 'utf8');
    // Skip comment lines: a doc comment that merely names the constructor is
    // not an element creation.
    const code = text.split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
    if (/new\s+(win\.)?Audio\(/.test(code) && !/productMusicAuthority/.test(rel)
      && !/uiSfxAuthority/.test(rel)) {
      const ok = /__apexAudioWarmOnly\s*=\s*true/.test(text) && /el\.muted\s*=\s*true/.test(text) && !/el\.play\(/.test(text);
      warmOnly.push(`${rel}:${ok ? 'muted-warm-only' : 'PLAYBACK ELEMENT'}`);
    }
  }
};
for (const r of roots) walkWarm(r);
check('the only other Audio creation is a muted, never-played prefetch warmer',
  warmOnly.length === 1 && /muted-warm-only$/.test(warmOnly[0]), warmOnly.join(','));
check('no second music AudioContext is created outside the authority', musicContexts === 0, `count=${musicContexts}`);

// The UI-SFX authority must never become a second MUSIC source: it may not
// reference the Forward Drive theme, and it must keep its own separate mute.
const UI_SFX_SRC = readFileSync(path.join(ROOT, 'public/game/ui/uiSfxAuthority.js'), 'utf8');
check('the UI-SFX authority never references the Forward Drive theme source',
  !/forward_drive_theme/.test(UI_SFX_SRC));
check('the UI-SFX authority keeps a mute separate from the music mute',
  /toggleMute/.test(UI_SFX_SRC) && !/__apexGoldMusicMuted\s*=/.test(UI_SFX_SRC));

const lines = ['FORWARD DRIVE MUSIC AUTHORITY GATE (owner law 2026-10-05)', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
process.exit(0);
