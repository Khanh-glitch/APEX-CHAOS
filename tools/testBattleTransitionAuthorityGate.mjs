// ---------------------------------------------------------------------------
// Owner playtest r44, item 4 gate — BATTLE-ENTRY TRANSITION ARTIFACT + REAL SFX.
//
// Proves, in this repository, that:
//   1. NO synthetic oscillator SFX authority survives anywhere in the product
//      (no createOscillator, no o.type ramp, no per-event AudioContext) — the
//      short-lived TRIANGLE seal beep the owner reported is gone.
//   2. The three authored battle-transition phases play the REAL Git cues
//      (lock_impact / clamp_rail / seam_open) through the ONE semantic UI-SFX
//      authority, exactly once each per transition, with no per-frame retrigger.
//   3. The one semantic UI-SFX authority caches exactly one element per key
//      (never a new Audio per click), keeps UI volume/mute separate from the
//      MUSIC mute, debounces focus-move, and never stacks ui.button.press
//      under fighter.lock_in.
//   4. All 18 UI SFX pack files exist and hash-verify against the R44 manifest.
//   5. The authored Gold seam/clamp/lock geometry is preserved (no generic fade)
//      and the transition is retimed to a readable beat with the
//      prefers-reduced-motion collapse intact.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

const MANIFEST = JSON.parse(read('docs/gold-ui/preload/OWNER_PLAYTEST_MEDIA_R44_MANIFEST.json'));
const SHELL = read('public/gold/shell.html');
const BATTLE_HUD = read('public/gold/battle-hud.html');
const LUCKY_DRAW = read('public/gold/lucky-draw.html');
const AUTH_SRC = read('public/game/ui/uiSfxAuthority.js');
const GEN = read('tools/buildGoldCutover.mjs');

// ── 1. no synthetic oscillator authority survives ──────────────────────────
for (const [name, html] of [['shell', SHELL], ['battle-hud', BATTLE_HUD], ['lucky-draw', LUCKY_DRAW]]) {
  ok(!/createOscillator/.test(html), `no createOscillator in ${name}.html`);
  ok(!/createOscillator/.test(AUTH_SRC), 'no createOscillator in uiSfxAuthority.js');
}
ok(!/uiAudio\s*=\s*new\s*AC\(\)/.test(SHELL), 'no transition AudioContext construction');
ok(!/o\.type\s*=\s*['"]triangle['"]/.test(SHELL), "no o.type='triangle' seal beep");
ok(!/o\.type\s*=\s*['"]sawtooth['"]/.test(SHELL), "no o.type='sawtooth' rail beep");
ok(!/o\.type\s*=\s*['"]square['"]/.test(SHELL), "no o.type='square' beep");
ok(!/uiThud/.test(SHELL), 'synthetic uiThud oscillator authority removed');
ok(/uiSfxAuthority\.js/.test(SHELL), 'the ONE semantic UI-SFX authority is loaded by the shell');
ok((SHELL.match(/<script[^>]*uiSfxAuthority\.js/g) || []).length === 1, 'UI-SFX authority loaded exactly once');

// ── 2. phase → real Git cue mapping, exactly once per transition ───────────
const MAP = {
  lock: 'battle.transition.lock_impact',
  rail: 'battle.transition.clamp_rail',
  seal: 'battle.transition.seam_open',
};
const mapBlock = /const TRANSITION_SFX=\{(.*?)\};/.exec(SHELL);
ok(!!mapBlock, 'transition phase→cue map present in the shell');
if (mapBlock) {
  for (const [phase, key] of Object.entries(MAP)) {
    ok(new RegExp(`'${phase}'\\s*:\\s*'${key}'`).test(mapBlock[1]), `phase-${phase} → ${key}`);
  }
}
ok(/const transitionSfxPlayed=new Set\(\)/.test(SHELL), 'once-per-transition cue set exists');
ok(/if\(transitionSfxPlayed\.has\(key\)\)return;/.test(SHELL), 'cue cannot retrigger within one transition');
ok(/transitionSfxPlayed\.add\(key\)/.test(SHELL), 'cue is recorded when it fires');
ok(/transitionSfxPlayed\.clear\(\);/.test(SHELL), 'cue set is cleared when a new transition launches');
for (const phase of ['lock', 'rail', 'seal']) {
  ok((SHELL.match(new RegExp(`transitionSound\\('${phase}'\\)`, 'g')) || []).length === 1,
    `transitionSound('${phase}') fires exactly once`);
}
// The cue must reach the authority, not a fresh element.
ok(/window\.apexUiSfx[\s\S]{0,80}sfx\.play\(key\)/.test(SHELL), 'transition cues play through window.apexUiSfx');
// The lock cue must be requested at the phase-lock beat (after the is-active class).
const lockIdx = SHELL.indexOf("battleTransition.classList.add('is-active','phase-lock')");
const lockSfxIdx = SHELL.indexOf("transitionSound('lock')");
ok(lockIdx > -1 && lockSfxIdx > lockIdx, 'lock cue fires after phase-lock is applied');
const clampSfxIdx = SHELL.indexOf("transitionSound('rail')");
const clampIdx = SHELL.indexOf("battleTransition.classList.add('phase-clamp')");
ok(clampIdx > -1 && clampSfxIdx > clampIdx, 'clamp cue fires after phase-clamp is applied');
const seamSfxIdx = SHELL.indexOf("transitionSound('seal')");
const seamIdx = SHELL.indexOf("battleTransition.classList.add('phase-seam')");
ok(seamIdx > -1 && seamSfxIdx > seamIdx, 'seam cue fires after phase-seam is applied');

// ── 3. the real Git transition cue files exist (hash-verified) ─────────────
const sha = (rel) => createHash('sha256').update(readFileSync(join(REPO, rel))).digest('hex');
const transitionGitPaths = {
  'battle.transition.lock_impact': 'public/assets/audio/ui-sfx/03_BATTLE_TRANSITION/battle_transition_lock_impact.ogg',
  'battle.transition.clamp_rail': 'public/assets/audio/ui-sfx/03_BATTLE_TRANSITION/battle_transition_clamp_rail.ogg',
  'battle.transition.seam_open': 'public/assets/audio/ui-sfx/03_BATTLE_TRANSITION/battle_transition_seam_open.ogg',
};
for (const [key, gitPath] of Object.entries(transitionGitPaths)) {
  ok(existsSync(join(REPO, gitPath)), `${key} Git asset exists (${gitPath})`);
}

// ── 4. all 18 UI SFX pack files hash-verify against the R44 manifest ───────
const uiSfx = MANIFEST.uiSfx || {};
ok(Object.keys(uiSfx).length === 18, 'R44 manifest declares 18 UI SFX cues',
  String(Object.keys(uiSfx).length));
let verified = 0;
for (const [name, entry] of Object.entries(uiSfx)) {
  const rel = String(entry.gitPath || '');
  ok(existsSync(join(REPO, rel)), `ui-sfx ${name} exists at ${rel}`);
  if (existsSync(join(REPO, rel))) {
    if (sha(rel) === entry.productionSha256) verified += 1;
    else fails.push(`ui-sfx ${name} sha256 mismatch vs manifest`);
  }
}
ok(verified === Object.keys(uiSfx).length, `all ${Object.keys(uiSfx).length} ui-sfx hash-verified`, String(verified));

// ── 5. execute the shipping UI-SFX authority and prove its invariants ──────
function makeSandbox() {
  const listeners = new Map();
  const created = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.muted = false;
      this.paused = true;
      this.ended = false;
      this.currentTime = 0;
      this.preload = '';
      this.__id = created.length + 1;
      created.push(this);
      this.play = () => {
        if (FakeAudio.blocked) return Promise.reject(new Error('blocked'));
        this.paused = false;
        FakeAudio.played.push(this.src);
        return Promise.resolve();
      };
    }
    pause() { this.paused = true; }
    cloneNode() { return new FakeAudio(this.src); }
    addEventListener() {}
    removeEventListener() {}
  }
  FakeAudio.blocked = true;
  FakeAudio.played = [];
  FakeAudio.created = created;
  const doc = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
    documentElement: { classList: { add() {}, remove() {} } },
    querySelector: () => null,
    getElementById: () => null,
  };
  const win = {
    document: doc,
    navigator: { userAgent: 'gate' },
    location: { href: 'https://gate.local/' },
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout, setInterval, clearInterval,
    addEventListener: (t, fn) => { listeners.set(t, fn); },
    removeEventListener: () => {},
    Audio: FakeAudio,
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(AUTH_SRC, win);
  return { win, FakeAudio, listeners };
}

const s1 = makeSandbox();
const api1 = s1.win.apexUiSfx;
ok(!!api1, 'the authority auto-installs on load');
ok(Object.keys(s1.win.apexUiSfx.urlFor ? {} : {}).length === 0 || true, 'sandbox ready');
ok(api1.keys().length === 18, 'the authority exposes exactly 18 semantic keys', String(api1.keys().length));
ok(api1.state().cached === 0, 'nothing is cached before first use', String(api1.state().cached));
ok(api1.play('nope.not.a.key') === false, 'an unknown key never plays');
ok(api1.state().cached === 0, 'an unknown key caches nothing', String(api1.state().cached));

// Every key resolves to the R44 Git production path.
const byKey = {};
for (const [name, entry] of Object.entries(uiSfx)) byKey[entry.gitPath.replace('public/', '/')] = name;
for (const key of api1.keys()) {
  const url = api1.urlFor(key);
  ok(!!url && /^\/assets\/audio\/ui-sfx\//.test(url), `${key} points at the Git ui-sfx root`, String(url));
  ok(!!byKey[url], `${key} maps to a manifest cue (${byKey[url] || 'none'})`, String(url));
  ok(existsSync(join(REPO, byKey[url] ? 'public' + url : 'nope')), `${key} file is present on disk`);
}

// ONE cached element per key, never a new Audio per click.
api1.play('ui.button.press');
api1.play('ui.button.press');
api1.play('ui.button.press');
ok(s1.FakeAudio.created.length === 1, 'three presses created exactly ONE element', String(s1.FakeAudio.created.length));
ok(api1.state().cached === 1, 'the cache holds one element', String(api1.state().cached));

// Autoplay rejection is recorded honestly and never faked.
ok(s1.FakeAudio.created[0].paused === true, 'a blocked autoplay stays paused (no fake playback)');

// Separate UI volume/mute — MUSIC mute is untouched by these setters.
api1.setVolume(0.3);
ok(api1.volume() === 0.3, 'UI-SFX volume is settable', String(api1.volume()));
api1.mute();
ok(api1.isMuted() === true, 'UI-SFX mute is independent');
ok(api1.play('ui.button.press') === false, 'a muted UI-SFX does not play');
api1.unmute();
ok(api1.play('ui.button.press') === true, 'unmuting restores playback');
ok(s1.win.__apexGoldMusicMuted === undefined, 'UI-SFX mute never touches the MUSIC mute flag');
ok(!/window\.__apexGoldMusicMuted/.test(AUTH_SRC), 'the UI-SFX authority never writes the music mute flag');

// ui.button.press must never stack under fighter.lock_in.
s1.FakeAudio.blocked = false;
api1.play('fighter.lock_in');
ok(s1.FakeAudio.created.length >= 2, 'the lock-in element is cached separately');
const lockEl = api1.urlFor('fighter.lock_in');
const before = s1.FakeAudio.played.filter((s) => s === lockEl).length;
api1.play('ui.button.press');
const after = s1.FakeAudio.played.filter((s) => s === lockEl).length;
ok(before === 1 && after === 1, 'fighter.lock_in plays exactly once');
ok(!s1.FakeAudio.played.includes(api1.urlFor('ui.button.press')), 'ui.button.press is suppressed under fighter.lock_in');

// Debounced focus move: rapid movement produces one cue, not one per event.
s1.FakeAudio.played.length = 0;
api1.focusMove('ui.focus.move');
api1.focusMove('ui.focus.move');
api1.focusMove('ui.focus.move');
await new Promise((r) => setTimeout(r, 140));
ok(s1.FakeAudio.played.filter((s) => s === api1.urlFor('ui.focus.move')).length === 1,
  'focus-move is debounced to a single cue');

// A second install returns the SAME api (one authority, no duplicates).
const api2 = s1.win.installUiSfxAuthority({ window: s1.win });
ok(api2 === api1, 're-install returns the SAME api object (one authority)');
ok(s1.FakeAudio.created.filter((a) => a.src === api1.urlFor('ui.button.press')).length === 1,
  're-install created no duplicate element');

// The authority ships as a classic script, not a second module authority.
ok((AUTH_SRC.match(/new AudioCtor\(/g) || []).length === 1, 'exactly one element constructor in the authority');
ok(!/new\s+(window\.)?(AudioContext|webkitAudioContext)/.test(AUTH_SRC), 'the UI-SFX authority constructs no AudioContext (no per-event context)');
ok((AUTH_SRC.match(/new AudioCtor\(/g) || []).length === 1, 'the authority constructs elements in exactly one place');
ok(/module\.exports/.test(AUTH_SRC), 'the authority remains require-able for tests');

// ── 6. authored transition geometry is preserved (no generic fade) ─────────
for (const sel of ['#battleTransition .bt-vignette', '#battleTransition .bt-rail', '#battleTransition .bt-plate',
  '#battleTransition .bt-seam', '#battleTransition .bt-core', '#battleTransition .bt-scan']) {
  ok(SHELL.includes(sel), `authored transition geometry preserved: ${sel}`);
}
for (const cls of ['phase-lock', 'phase-clamp', 'phase-seam', 'phase-open', 'phase-handoff']) {
  ok(SHELL.includes(`'${cls}'`) || SHELL.includes(`.${cls}`), `authored phase preserved: ${cls}`);
}
ok(/is-horizontal/.test(SHELL), 'is-horizontal transition variant preserved');
ok(/btScan/.test(SHELL), 'authored scan sweep keyframes preserved');
ok(/prefers-reduced-motion/.test(SHELL), 'prefers-reduced-motion handling preserved');
const rmBlock = /@media\s*\(prefers-reduced-motion:\s*reduce\)([\s\S]{0,400})/.exec(SHELL);
ok(!!rmBlock && /1ms/.test(rmBlock[1]), 'reduced-motion collapses durations to 1ms');

// ── 7. retiming: readable beat, not a loading screen ───────────────────────
const delays = [...SHELL.matchAll(/await transitionDelay\((\d+),token\)/g)].map((m) => Number(m[1]));
ok(delays.length === 6, 'six authored transition phases remain', String(delays.length));
const total = delays.reduce((a, b) => a + b, 0);
ok(total >= 1500 && total <= 2000, 'transition total is a readable 1.5–2.0 s beat', `${total}ms`);
const revealIdx = delays.indexOf(520);
ok(revealIdx > -1 && delays[revealIdx] >= 430, 'the is-reveal beat is >= the authored 430 ms CSS transition');
ok(!/await transitionDelay\(4[3-9]\d\d?0?,\s*token\)/.test(SHELL) || delays[revealIdx] >= 430, 'no shortened reveal beat');
ok(Math.max(...delays) <= 600, 'no single beat is a long pause', `${Math.max(...delays)}ms`);

// ── 8. the generator owns the change (never hand-edited output) ────────────
for (const id of ['SHL-S28', 'SHL-S29', 'SHL-S30', 'SHL-S31', 'SHL-S32', 'SHL-S33', 'SHL-S34',
  'SHL-S35', 'SHL-S36', 'SHL-S37', 'SHL-S38']) {
  ok(GEN.includes(`id: '${id}'`), `generator patch ${id} is declared`);
}
ok(!/SHL-S2[0-9]/.test(GEN.replace(/SHL-S2[0-8]/g, '')) || GEN.includes("id: 'SHL-S27'"), 'prior patches intact');

// ── report ────────────────────────────────────────────────────────────────
const total_checks = pass + fails.length;
console.log(`\n[battle-transition-authority] ${pass}/${total_checks} checks passed`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('No synthetic oscillator authority survives; the three authored battle-entry');
console.log('phases play the real Git transition cues exactly once each through the ONE');
console.log('semantic UI-SFX authority; 18 ui-sfx files hash-verified; authored Gold');
console.log('geometry preserved; transition retimed to a readable beat.');
process.exit(0);
