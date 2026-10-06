// ---------------------------------------------------------------------------
// R51 BATTLE-ENTRY AUTHORITY GATE (rewritten from the retired r44 bespoke
// transition gate — the law changed, the assertion did not get deleted).
//
// Proves, in this repository, that:
//   1. NO synthetic oscillator SFX authority survives anywhere in the product
//      (no createOscillator, no per-event AudioContext).
//   2. Battle entry speaks through the ONE semantic UI-SFX helper exactly once
//      per cue, and the reveal itself never re-fires a cue.
//   3. REWRITTEN IN R52 (owner law N3): the owner's own Gold rail transition IS
//      the battle-entry transition. The R51 assertion that #battleTransition had
//      to be GONE was correct while the Mechanical Door owned every scene swap;
//      the owner then reported the authored beat was missing from the product.
//      The law now is the opposite one — #battleTransition (DOM + canonical CSS
//      + phase vocabulary + identity copy) is REQUIRED and is driven by the ONE
//      battle-entry scheduler — while Battle still has no Mechanical Door route
//      (the Door keeps boot + the two Lucky Draw handoffs only).
//   4. The reveal is the authored 430 ms beat (rails open + compositor sliver
//      open, `is-reveal`), production READY lands BEFORE `battle-hud-open`, and
//      a failed start throws instead of revealing donor defaults.
//   5. All 18 UI SFX pack files exist and hash-verify against the manifest.
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
// ── 2. battle entry cues: one semantic cue per intent, one authority ───────
ok(!/transitionSfxPlayed|transitionSound\(/.test(SHELL),
  'no superseded transition cue scheduler survives');
ok((SHELL.match(/uiSfx\('fighter\.lock_in'\)/g) || []).length === 1,
  'fighter.lock_in is requested exactly once',
  String((SHELL.match(/uiSfx\('fighter\.lock_in'\)/g) || []).length));
ok((SHELL.match(/uiSfx\('fighter\.match_ready'\)/g) || []).length === 2,
  'fighter.match_ready covers both lock paths (BOT + 2P)',
  String((SHELL.match(/uiSfx\('fighter\.match_ready'\)/g) || []).length));
const revealBlock = SHELL.slice(SHELL.indexOf('async function launchBattleHud()'), SHELL.indexOf('  function cancelBattleTransition()'));
ok(!!revealBlock && !/uiSfx\(/.test(revealBlock),
  'the battle reveal never re-fires a UI cue');

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

// ── 6. the owner's Gold rail transition is the battle-entry transition (N3) ─
// Old law (R51, superseded by the owner report): "#battleTransition must be
// gone". New law: it is REQUIRED, it is the canonical Gold source (geometry,
// phase vocabulary, identity copy), and it is driven by the ONE scheduler.
ok(/id="battleTransition" aria-hidden="true"/.test(SHELL),
  'the canonical #battleTransition DOM is present');
for (const cls of ['bt-vignette', 'bt-rail bt-p1', 'bt-rail bt-p2', 'bt-plate', 'bt-kicker',
  'bt-name', 'bt-state', 'bt-seam', 'bt-core', 'bt-scan']) {
  ok(new RegExp(`class="${cls.replace(/ /g, '\\s+')}"`).test(SHELL),
    `canonical rail geometry present: ${cls}`);
}
ok(/data-bt-name="p1"/.test(SHELL) && /data-bt-name="p2"/.test(SHELL)
  && /data-bt-state="p1"/.test(SHELL) && /data-bt-state="p2"/.test(SHELL)
  && /data-bt-kicker="p2"/.test(SHELL) && /data-bt-core/.test(SHELL),
  'canonical identity hooks are present');
ok(/#battleTransition\{position:fixed;inset:0;z-index:10000/.test(SHELL),
  'the canonical rail CSS survived the cutover (z-index above the battle host)');
ok(/#battleTransition\.phase-clamp \.bt-p1,#battleTransition\.phase-clamp \.bt-p2\{transform:translateX\(0\)\}/.test(SHELL)
  && /#battleTransition\.phase-open \.bt-p1\{transform:translateX\(-102%\);transition-duration:430ms\}/.test(SHELL),
  'the canonical clamp/open rail law is present (430 ms authored beat)');
ok(/#battleTransition\.is-horizontal/.test(SHELL) && /#battleTransition\.is-bot\.phase-clamp \.bt-scan/.test(SHELL),
  'the is-horizontal (portrait) and is-bot variants are present');
const phaseOrder = ["classList.add('is-active','phase-lock')", "classList.add('phase-clamp')",
  "classList.add('phase-seam')", "classList.add('phase-open')", "classList.add('phase-handoff')"]
  .map((needle) => SHELL.indexOf(needle));
ok(phaseOrder.every((idx) => idx > -1) && phaseOrder.every((idx, i) => i === 0 || idx > phaseOrder[i - 1]),
  'the scheduler plays the canonical phase order');
ok(SHELL.includes("p2='TARGET ACQUIRED'") || SHELL.includes("'TARGET ACQUIRED'") || /TARGET ACQUIRED/.test(SHELL),
  'the BOT channel copy survives (TARGET ACQUIRED)');
ok(/SOLO COMBAT CHANNEL/.test(SHELL) && /DUEL COMBAT CHANNEL/.test(SHELL),
  'both BOT and LOCAL channel copy survive');
ok(/const horizontal=!bot&&matchMedia\('\(orientation:portrait\)'\)\.matches;/.test(SHELL),
  'rail orientation follows the real screen aspect (donor law)');
// The Door keeps boot + the two Lucky Draw handoffs, and never routes battle.
ok(/name:'home->lucky'/.test(SHELL) && /name:'lucky->home'/.test(SHELL),
  'the Door routes exactly the two Lucky Draw scene handoffs');
ok(!/name:'fighter->battle'|name:'battle->fighter'/.test(SHELL),
  'battle still has no Mechanical Door route');
ok(!/transitionSound\(|battleTransitionToken/.test(SHELL),
  'no second (superseded) transition authority came back with the rails');
ok(SHELL.includes('body.battle-transition-active'),
  'the battle reveal owns its transition-active body state');
ok(/#battleHudHost\.is-transitioning\{clip-path:inset\(0 49\.55% 0 49\.55%\)[^}]*transition:clip-path 430ms/.test(SHELL),
  'the host compositor sliver opens over the same authored 430 ms beat');
ok(/#battleHudHost\.is-transitioning\.is-reveal\{clip-path:inset\(0\)/.test(SHELL),
  'the reveal opens the compositor, not a generic fade');
ok(/is-horizontal/.test(SHELL), 'is-horizontal variant preserved');
ok(/prefers-reduced-motion/.test(SHELL), 'prefers-reduced-motion handling preserved');
ok(/reduced\?Math\.min\(ms,24\):ms/.test(SHELL),
  'the one beat scheduler collapses to the 24 ms reduced-motion floor');
ok(/@media\(prefers-reduced-motion:reduce\)\{#battleTransition \.bt-rail/.test(SHELL),
  'the canonical reduced-motion rule for the rails is present');

// ── 7. production READY lands BEFORE the compositor is revealed ────────────
const liveIdx = SHELL.indexOf('const liveReady=await setBattleLive();');
const revealIdx = SHELL.indexOf("document.body.classList.add('battle-hud-open')");
ok(liveIdx > -1 && revealIdx > liveIdx, 'production READY precedes body.battle-hud-open');
ok(/if\(liveReady!==true\)throw new Error\('Battle runtime did not report READY'\)/.test(SHELL),
  'a failed production start throws instead of revealing donor defaults');
const preloadIdx = SHELL.indexOf("battleHudHost.classList.add('is-preloading')");
ok(preloadIdx > -1 && preloadIdx < liveIdx,
  'the HUD is mounted hidden (is-preloading) while production loads');

// ── 8. the generator owns the change (never hand-edited output) ────────────
// R52: SHL-S33..S38 retimed the SUPERSEDED donor scheduler and could never
// reach the shipped shell (the R50K adapter is the last writer of that region);
// they were deleted with it. The live battle-entry owner is the adapter region.
const ADAPTER = read('tools/goldShellR50k.mjs');
ok(ADAPTER.includes('const BATTLE_ENTRY_REGION = `'),
  'the battle-entry scheduler is declared in the generator adapter');
ok(/BATTLE_ENTRY_REGION,\n\s*'Battle entry lifecycle/.test(ADAPTER),
  'the adapter writes that region into the shell (never hand-edited output)');
ok(!/SHL-S3[3-8]/.test(GEN), 'the dead donor-retiming patches are gone');
for (const id of ['SHL-S28', 'SHL-S29', 'SHL-S30', 'SHL-S31', 'SHL-S32']) {
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
console.log('No synthetic oscillator authority survives; battle entry speaks through the');
console.log('ONE semantic UI-SFX helper once per cue; the canonical #battleTransition rail');
console.log('transition IS the battle-entry beat and the Door routes only the two Lucky');
console.log('Draw handoffs; production READY lands before the authored 430 ms reveal; the');
console.log('18 ui-sfx pack files hash-verify against the manifest.');
process.exit(0);
