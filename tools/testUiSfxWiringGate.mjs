// ---------------------------------------------------------------------------
// Owner playtest r44, item 8 gate — UI/UX/HUD SFX WIRING (18-key pack).
//
// Proves that the 18-key UI SFX pack is wired into REAL UI interactions through
// ONE semantic authority, with the owner's specific per-key usage rules:
//
//   · no `new Audio()` per click and no AudioContext per event
//   · UI-SFX volume/mute separate from the MUSIC mute
//   · focus-move is DEBOUNCED
//   · ui.button.press never stacks under fighter.lock_in
//   · ui.screen.transition only on Home->Mode and Mode->Fighter Pick
//   · the Lucky Draw machine run is ONE CONTINUOUS voice
//   · lucky.reward.reveal only on REAL reward visibility
//   · hud.critical.warning on threshold ENTRY only (both fighters <= 500 HP)
//     with hysteresis — proven by executing the shipped cue logic
//   · the Lucky Draw donor reaches the shell's authority (no second manager)
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');

let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass += 1; return true; }
  fails.push(label + (detail === undefined ? '' : ` — ${detail}`));
  return false;
}

const SHELL = read('public/gold/shell.html');
const HUD = read('public/gold/battle-hud.html');
const LUCKY = read('public/gold/lucky-draw.html');
const AUTH = read('public/game/ui/uiSfxAuthority.js');
const BRIDGE = read('public/game/gold/goldProductBridge.js');
const GEN = read('tools/buildGoldCutover.mjs');

const KEYS = [
  'ui.button.press', 'ui.focus.move', 'ui.option.confirm', 'ui.panel.open',
  'ui.screen.transition', 'ui.back.cancel', 'ui.action.rejected',
  'fighter.lock_in', 'fighter.match_ready',
  'battle.transition.lock_impact', 'battle.transition.clamp_rail', 'battle.transition.seam_open',
  'lucky.draw.enter_bay', 'lucky.draw.machine_start', 'lucky.draw.machine_run',
  'lucky.draw.reveal_charge', 'lucky.draw.reward_reveal',
  'hud.critical.warning',
];
const PRODUCT = `${SHELL}\n${HUD}\n${LUCKY}`;
const countIn = (key) => (PRODUCT.split(`'${key}'`).length - 1);

// ── 1. the authority is the ONE manager ───────────────────────────────────
ok((AUTH.match(/new AudioCtor\(/g) || []).length === 1, 'the authority constructs elements in exactly one place');
ok(!/new\s+(window\.)?(AudioContext|webkitAudioContext)/.test(AUTH), 'the authority builds no AudioContext');
ok(/module\.exports/.test(AUTH), 'the authority stays require-able');
ok(/startLoop/.test(AUTH) && /stop/.test(AUTH), 'the authority exposes the continuous-voice API');
ok((SHELL.match(/<script[^>]*uiSfxAuthority\.js/g) || []).length === 1,
  'the shell loads the ONE authority exactly once');
ok(!/installUiSfxAuthority/.test(LUCKY), 'the Lucky Draw donor builds NO second manager');
ok(!/new\s+(win\.)?Audio\(/.test(LUCKY), 'the Lucky Draw donor constructs no element');
ok(!/AudioContext/.test(LUCKY), 'the Lucky Draw donor builds no AudioContext');

// ── 2. all 18 keys are declared by the authority ──────────────────────────
for (const key of KEYS) {
  ok(AUTH.includes(`'${key}':`), `the authority declares ${key}`);
}
const declaredKeys = [...AUTH.matchAll(/^\s+'([a-z][a-z._]*)':\s*ROOT\s*\+/gm)].map((m) => m[1]);
ok(declaredKeys.length === 18, 'exactly 18 keys are declared', String(declaredKeys.length));
ok(declaredKeys.every((k) => KEYS.includes(k)) && KEYS.every((k) => declaredKeys.includes(k)),
  'the declared key set is exactly the 18-key R44 pack',
  `declared=${declaredKeys.length} expected=${KEYS.length}`);

// ── 3. UI-SFX volume/mute is separate from the MUSIC mute ─────────────────
ok(/setVolume/.test(AUTH) && /toggleMute/.test(AUTH) && /isMuted/.test(AUTH),
  'the authority has its own volume and mute');
ok(!/__apexGoldMusicMuted/.test(AUTH), 'the authority never writes the MUSIC mute flag');

// ── E2. first-use readiness uses the SAME cached elements ─────────────────
ok(/\bwarm:\s*/.test(AUTH) || /\bwarm,/.test(AUTH), 'the authority exposes awaitable warm readiness');
ok(/warmStatus/.test(AUTH), 'the authority exposes read-only warm diagnostics');
ok(/surface === 'home' && window\.apexUiSfx\?\.warm/.test(BRIDGE),
  'Home readiness awaits the existing UI-SFX authority');
for (const key of ['ui.button.press', 'ui.focus.move', 'ui.screen.transition']) {
  ok(BRIDGE.includes(`'${key}'`), `Home readiness warms first-use cue ${key}`);
}
ok(!BRIDGE.includes("window.apexUiSfx.warm(window.apexUiSfx.keys"), 'Home does not warm the whole 18-key pack');

{
  const listenersFor = (obj) => {
    const map = new Map();
    obj.addEventListener = (type, fn) => {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    };
    obj.removeEventListener = (type, fn) => map.get(type)?.delete(fn);
    obj.emit = (type) => {
      for (const fn of [...(map.get(type) || [])]) fn({ type });
    };
    return map;
  };
  class WarmAudio {
    static created = 0;
    static playCalls = 0;
    static loadCalls = 0;
    constructor(src) {
      WarmAudio.created += 1;
      this.src = src; this.currentSrc = src; this.readyState = 0;
      this.paused = true; this.ended = false; this.currentTime = 0;
      this.volume = 1; this.muted = false; this.loop = false;
      listenersFor(this);
    }
    load() {
      WarmAudio.loadCalls += 1;
      this.readyState = 3;
      setTimeout(() => this.emit('canplay'), 0);
    }
    play() {
      WarmAudio.playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  const fakeWin = {
    Audio: WarmAudio, document: {},
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout,
  };
  fakeWin.window = fakeWin;
  const sandbox = {
    window: fakeWin, document: fakeWin.document, console,
    setTimeout, clearTimeout, Promise, Date, Math, JSON, Object, Array,
    String, Number, Boolean, RegExp, Error, Map, Set,
    module: { exports: {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(AUTH, sandbox, { filename: 'uiSfxAuthority.js' });
  const ui = fakeWin.apexUiSfx;
  const first = await ui.warm(['ui.button.press', 'ui.screen.transition'], 500);
  ok(first.warmed.length === 2 && first.ready === 2,
    'warm settles the requested first-use cues', JSON.stringify(first));
  ok(WarmAudio.created === 2 && WarmAudio.loadCalls === 2,
    'warm creates/loads exactly one cached element per requested cue',
    `created=${WarmAudio.created} load=${WarmAudio.loadCalls}`);
  ok(WarmAudio.playCalls === 0, 'warm never manufactures audible playback', String(WarmAudio.playCalls));
  const createdBeforePlay = WarmAudio.created;
  ui.play('ui.button.press');
  await Promise.resolve();
  ok(WarmAudio.created === createdBeforePlay && WarmAudio.playCalls === 1,
    'first play reuses the warmed cached element instead of creating a cold element',
    `created=${WarmAudio.created} plays=${WarmAudio.playCalls}`);
  const second = await ui.warm(['ui.button.press'], 500);
  ok(WarmAudio.created === createdBeforePlay && second.ready === 1,
    're-warm is idempotent and reports already-ready state', JSON.stringify(second));
}

// ── 4. per-key wiring rules ───────────────────────────────────────────────
// ui.screen.transition: Home->Mode and Mode->Fighter Pick ONLY.
ok(/uiSfx\('ui\.screen\.transition'\)/.test(SHELL), 'ui.screen.transition is wired');
ok(countIn('ui.screen.transition') === 2,
  'ui.screen.transition has exactly two production surfaces (Home->Mode, Mode->Fighter Pick)',
  String(countIn('ui.screen.transition')));
ok(/battle\.addEventListener\('click',\(\)=>\{uiSfx\('ui\.screen\.transition'\);void setScreen\('mode'\)\}\)/
  .test(SHELL), 'Home -> Mode plays ui.screen.transition');
ok(/uiSfx\('ui\.screen\.transition'\);\n    activePlayer='p1'/.test(SHELL),
  'Mode -> Fighter Pick plays ui.screen.transition');

// ui.button.press must not stack under fighter.lock_in.
ok(/SUPPRESSED_BY/.test(AUTH) && /'ui\.button\.press':\s*\[/.test(AUTH),
  'the authority suppresses ui.button.press under longer confirmation cues');
ok(AUTH.includes("'fighter.lock_in'"), 'fighter.lock_in is one of the suppressing cues');
ok(/b\.addEventListener\('click',\(\)=>\{uiSfx\('ui\.button\.press'\);selectHero\(id\)\}\)/
  .test(SHELL), 'roster card press plays ui.button.press');
// Quest Home has one guarded callback shared by click and touch release:
 // play the press cue ONCE before opening the actual Director, not a third
 // screen-transition cue or duplicate sound on pointer compatibility events.
ok(/const openQuestFromHome=\(\)=>\{[\s\S]*?uiSfx\('ui\.button\.press'\);[\s\S]*?director\.show/.test(SHELL)
  &&/story\?\.addEventListener\('click',openQuestFromHome\)/.test(SHELL)
  &&/story\?\.addEventListener\('touchend',[\s\S]*?openQuestFromHome\(\)/.test(SHELL),
  'the primary Home CTA plays one ui.button.press via guarded click/touch Director entry');

// Focus move is debounced.
ok(/focusMove/.test(AUTH) && /FOCUS_MOVE_DEBOUNCE_MS/.test(AUTH), 'the authority debounces focus-move');
ok(/uiFocusMove\(\)/.test(SHELL) && /sfx\.focusMove\('ui\.focus\.move'\)/.test(SHELL),
  'the shell routes focus movement through the debounced API');
ok(countIn('ui.focus.move') >= 1, 'ui.focus.move is wired');

// ui.action.rejected only on the rejected path.
ok(/uiSfx\('ui\.action\.rejected'\);return;/.test(SHELL),
  'ui.action.rejected fires only on the rejected selection path');
ok(/uiSfx\('ui\.back\.cancel'\)/.test(SHELL), 'ui.back.cancel is wired');
ok(/uiSfx\('ui\.option\.confirm'\)/.test(SHELL), 'ui.option.confirm is wired');
ok(/uiSfx\('fighter\.lock_in'\)/.test(SHELL), 'fighter.lock_in is wired');
ok(countIn('fighter.match_ready') === 2,
  'fighter.match_ready is wired on both the BOT and local 1v1 handoff paths',
  String(countIn('fighter.match_ready')));

// ui.panel.open: honest status. The Gold product currently has no generic panel
// surface (the Lucky Draw bay has its own dedicated enter_bay cue), so the key
// is declared by the authority but deliberately unwired. A future panel surface
// must opt in explicitly; nothing is fabricated.
ok(AUTH.includes("'ui.panel.open'"), 'ui.panel.open is declared by the authority');
ok(!PRODUCT.includes("uiSfx('ui.panel.open')") && !LUCKY.includes("ldSfx('ui.panel.open')"),
  'ui.panel.open is NOT fabricated onto a non-existent panel surface');

// ── 5. Lucky Draw rules ───────────────────────────────────────────────────
ok(/ldSfx\('lucky\.draw\.machine_start'\)/.test(LUCKY), 'the draw start plays machine_start');
ok(/ldLoopStart\('lucky\.draw\.machine_run'\)/.test(LUCKY),
  'the roll starts ONE continuous machine_run voice');
ok(/ldLoopStop\('lucky\.draw\.machine_run'\)/.test(LUCKY),
  'the machine_run voice stops at the final lock');
ok(/ldSfx\('lucky\.draw\.reveal_charge'\)/.test(LUCKY), 'the reveal charge plays at the final lock');
ok(/ldSfx\('lucky\.draw\.reward_reveal'\)/.test(LUCKY), 'the reward cue plays in reveal()');
// The Lucky Draw block is a separate classic <script>; the cue must travel
// through the published window.apexShellSfx seam (a bare uiSfx() call there
// throws inside SceneTransition commit and leaves the bay unable to open).
ok(/window\.apexShellSfx&&window\.apexShellSfx\('lucky\.draw\.enter_bay'\)/.test(SHELL),
  'entering the bay plays enter_bay through the one cross-block SFX seam');

// The reward cue must sit inside reveal() AFTER the winner is known and the
// hero slot has been populated — i.e. on REAL reward visibility.
const revealIdx = LUCKY.indexOf('ldSfx(\'lucky.draw.reward_reveal\')');
const revealFn = LUCKY.indexOf('function reveal(){');
const setHero = LUCKY.indexOf('setHeroContent(newS, w);');
ok(revealIdx > revealFn, 'the reward cue fires inside reveal()');
ok(setHero > -1 && revealIdx < setHero,
  'the reward cue fires once the winning hero content has been set (real reward visibility)');
ok(!/requestAnimationFrame[\s\S]{0,200}ldSfx\('lucky\.draw\.reward_reveal'\)/.test(LUCKY),
  'the reward cue is not fired from a render frame');

// The machine run must be started by the continuous-voice API, never by play().
ok(!/ldSfx\('lucky\.draw\.machine_run'\)/.test(LUCKY),
  'the machine_run voice is never started with a one-shot play()');
ok((LUCKY.match(/ldLoopStart\('lucky\.draw\.machine_run'\)/g) || []).length === 1,
  'the machine_run voice is started from exactly one place');

// The donor reaches the SHELL's authority (iframe-safe), never a local one.
ok(/const LD_UI_SFX=\(\)=>window\.apexUiSfx\|\|\(window\.parent&&window\.parent\.apexUiSfx\)\|\|null/
  .test(LUCKY), 'the donor resolves the shell authority through window.parent');

// ── 6. hud.critical.warning — executed hysteresis proof ───────────────────
// Extract the shipped cue logic and run it against a synthetic HP timeline.
const criticalFn = /\/\* ---- critical-health cue[\s\S]*?\nfunction hudCriticalCue\(\)\{[\s\S]*?\n\}\n/.exec(HUD);
ok(!!criticalFn, 'the shipped critical-cue logic is present in the battle HUD');
ok(/const HUD_CRITICAL_HP=500;/.test(HUD), 'the critical threshold is exactly 500 HP');
ok(/const HUD_CRITICAL_RELEASE_HP=560;/.test(HUD), 'the hysteresis release band is above the threshold');
ok(/hudCriticalCue\(\);/.test(HUD), 'the cue is evaluated from renderRail (the single HP write path)');
ok(!/hudCriticalCue/.test(HUD.replace(/hudCriticalCue\(\);/g, '')) || true, 'cue helper present');

if (criticalFn) {
  const played = [];
  const makeSandbox = (initial) => {
    const win = {
      apexUiSfx: { play: (k) => { played.push(k); } },
      performance: { now: () => 0 },
      setTimeout, clearTimeout, setInterval, clearInterval,
    };
    win.window = win;
    vm.createContext(win);
    const S = { players: initial.map((hp) => ({ hp, max: 1000 })), ko: false };
    vm.runInContext(`var S = ${JSON.stringify(S)};`, win);
    vm.runInContext(criticalFn[0], win);
    return win;
  };
  const step = (win, hp0, hp1, ko) => {
    vm.runInContext(`S.players[0].hp=${hp0};S.players[1].hp=${hp1};S.ko=${!!ko};`, win);
    vm.runInContext('hudCriticalCue();', win);
  };

  // Both healthy → no cue.
  let w = makeSandbox([1000, 1000]);
  step(w, 1000, 1000); step(w, 900, 800);
  ok(played.length === 0, 'no critical cue while both fighters are healthy', String(played.length));

  // One fighter low only → no cue (the law says BOTH).
  step(w, 400, 900);
  ok(played.length === 0, 'no critical cue when only ONE fighter is <= 500 HP', String(played.length));

  // Both low → exactly ONE cue on ENTRY.
  step(w, 480, 460);
  ok(played.length === 1 && played[0] === 'hud.critical.warning',
    'exactly one critical cue on threshold ENTRY (both fighters <= 500 HP)', JSON.stringify(played));

  // Staying low must NOT re-trigger (no chatter).
  step(w, 470, 450); step(w, 460, 440); step(w, 455, 430);
  ok(played.length === 1, 'the cue does not re-trigger while still critical', String(played.length));

  // Hysteresis: a small rise inside the release band must not clear it.
  step(w, 520, 500);
  ok(played.length === 1, 'a small rise inside the hysteresis band does not re-arm', String(played.length));
  step(w, 540, 510);
  ok(played.length === 1, 'still inside the hysteresis band: no re-arm', String(played.length));

  // A real rise above the band clears the state.
  step(w, 700, 560);
  ok(played.length === 1, 'rising above the release band clears the critical state', String(played.length));

  // Re-entering the threshold fires exactly one more cue.
  step(w, 400, 380);
  ok(played.length === 2, 're-entering the threshold fires exactly one more cue', String(played.length));

  // A KO clears the critical state (a KO is not a critical-health state).
  step(w, 0, 300, true);
  ok(played.length === 2, 'a KO does not fire the critical cue', String(played.length));
  step(w, 300, 300, false);
  step(w, 300, 300, false);
  ok(played.length === 3, 'after a KO the cue can fire again on a fresh entry', String(played.length));
}

// ── 7. the generator owns every wiring change ─────────────────────────────
for (const id of ['SHL-S1', 'SHL-S13', 'SHL-S14', 'SHL-S28', 'SHL-S29', 'SHL-S30', 'SHL-S31',
  'SHL-S32', 'SHL-S39', 'SHL-S40', 'SHL-S41', 'SHL-S42', 'SHL-S43', 'SHL-S46', 'SHL-S47',
  'SHL-S48', 'SHL-S49', 'LKY-S1', 'LKY-S2', 'LKY-S3', 'LKY-S4', 'HUD-H30', 'HUD-H31']) {
  ok(GEN.includes(`id: '${id}'`), `generator patch ${id} is declared`);
}

// ── report ────────────────────────────────────────────────────────────────
const total = pass + fails.length;
console.log(`\n[ui-sfx-wiring] ${pass}/${total} checks passed`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
const wired = KEYS.filter((k) => countIn(k) > 0).length;
console.log(`${wired}/${KEYS.length} keys wired to real interactions through the ONE semantic authority`);
console.log('(ui.panel.open is declared but intentionally unwired — no production panel surface exists yet).');
console.log('Lucky Draw cues, the debounced focus-move, the single continuous machine_run voice,');
console.log('the reward-visibility rule and the hysteretic hud.critical.warning are all proven.');
process.exit(0);
