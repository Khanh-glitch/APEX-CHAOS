// THEME MUSIC (Forward Drive) — required AV proof A..K.
//
// Owner law: docs/gold-ui/preload/music/README.md and README_AV_THEME_PRELOAD.md.
// Deterministic and browser-independent: the controller is driven with an
// injected clock/media mock, so continuity, fade, surface policy, tab/window
// and M-key behavior are all provable without a real browser.
//
//   node tools/testThemeMusicAuthority.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
  THEME_MUSIC,
  createThemeMusicController,
  themePolicyFor,
  themeSurfacePolicyTable,
  THEME_DECISION,
} from '../src/game/themeMusic.js';
import { getProductSurface, PRODUCT_AVAILABILITY } from '../src/game/productSurface.js';

const report = { gates: {}, failures: [] };
function gate(name, fn) {
  try {
    const detail = fn();
    report.gates[name] = { pass: true, detail };
    console.log(`PASS  ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  } catch (error) {
    const detail = String(error?.stack || error);
    report.gates[name] = { pass: false, detail };
    report.failures.push(name);
    console.log(`FAIL  ${name} — ${detail}`);
  }
}

// ── Deterministic HTMLMediaElement + timer mock ─────────────────────────────
function makeMedia({ currentTime = 0, duration = THEME_MUSIC.durationSeconds } = {}) {
  const media = {
    currentTime,
    duration,
    volume: THEME_MUSIC.targetVolume,
    paused: true,
    loop: THEME_MUSIC.loop,
    src: THEME_MUSIC.src,
    playCalls: 0,
    pauseCalls: 0,
    play() { media.playCalls += 1; media.paused = false; return Promise.resolve(); },
    pause() { media.pauseCalls += 1; media.paused = true; },
  };
  return media;
}

// Manual clock: nothing depends on real timers, so a fade always completes in
// exactly ceil(fadeMs / stepMs) ticks and can be inspected mid-ramp.
function makeClock() {
  const timers = [];
  let nextId = 1;
  return {
    setInterval: (fn, ms) => { const handle = { id: nextId++, fn, ms, cancelled: false }; timers.push(handle); return handle; },
    clearInterval: (handle) => { if (handle) handle.cancelled = true; },
    // Run every live timer once (one fade step).
    tick(times = 1) {
      for (let i = 0; i < times; i++) {
        for (const t of [...timers]) {
          if (!t.cancelled) t.fn();
        }
      }
    },
    // Run enough steps to settle any in-flight fade.
    settle() {
      for (let guard = 0; guard < 200; guard++) {
        const live = timers.filter((t) => !t.cancelled);
        if (!live.length) return;
        for (const t of live) { if (!t.cancelled) t.fn(); }
      }
    },
    liveTimers: () => timers.filter((t) => !t.cancelled).length,
    created: () => timers.length,
  };
}

function makeHarness(initialSurface = 'home', overrides = {}) {
  const clock = makeClock();
  const media = makeMedia();
  const controller = createThemeMusicController({
    media,
    surface: initialSurface,
    fadeMs: THEME_MUSIC.fadeMs,
    targetVolume: THEME_MUSIC.targetVolume,
    stepMs: 16,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    ...overrides,
  });
  // Advance the playhead like real playback without touching the controller.
  const advance = (seconds) => { media.currentTime += seconds; };
  return { controller, media, clock, advance };
}

const FADE_STEPS = Math.ceil(THEME_MUSIC.fadeMs / 16);

// ── A. Home -> BOT Pick ──────────────────────────────────────────────────────
gate('A-home-to-bot-pick-continues-without-restart', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(41.5);
  const before = media.currentTime;
  controller.setSurface('bot-pick');
  clock.settle();
  assert.equal(media.currentTime, before, 'playhead must not move on navigation');
  assert.equal(media.paused, false, 'theme keeps playing');
  assert.equal(media.volume, THEME_MUSIC.targetVolume);
  assert.equal(controller.stats.playheadResets, 0);
  return `playhead preserved at ${before}s; theme still audible`;
});

// ── B. Home -> Local Pick ────────────────────────────────────────────────────
gate('B-home-to-local-pick-continues-without-restart', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(77.25);
  const before = media.currentTime;
  controller.setSurface('local-pick');
  clock.settle();
  assert.equal(media.currentTime, before);
  assert.equal(media.paused, false);
  return `playhead preserved at ${before}s`;
});

gate('playhead-monotonic-across-allowed-navigation', () => {
  const { controller, media, clock } = makeHarness('home');
  const seen = [];
  for (const [surface, dt] of [['home', 3], ['bot-pick', 4], ['pick', 5], ['local-pick', 6], ['result', 7]]) {
    media.currentTime += dt;
    controller.setSurface(surface);
    clock.settle();
    seen.push(media.currentTime);
  }
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] > seen[i - 1], `playhead went backwards at step ${i}: ${seen[i - 1]} -> ${seen[i]}`);
  }
  return `monotonic ${seen.join(' -> ')}s`;
});

// ── C. allowed -> Lucky Draw ─────────────────────────────────────────────────
gate('C-allowed-to-lucky-draw-fades-out-and-preserves-playhead', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(63.9);
  const before = media.currentTime;
  controller.setSurface('lucky-draw');
  // Mid-fade: volume is between 0 and target, and the element is NOT hard-cut.
  clock.tick(3);
  assert.ok(media.volume > 0 && media.volume < THEME_MUSIC.targetVolume,
    `expected a mid-fade volume, got ${media.volume}`);
  assert.equal(controller.stats.hardCuts, 0, 'no hard cut on an ordinary surface transition');
  assert.ok(media.volume > 0 || !media.paused, 'fade must run before the pause lands');
  clock.settle();
  assert.equal(media.volume, 0, 'faded fully out');
  assert.equal(media.paused, true, 'paused after the fade');
  assert.equal(media.currentTime, before, 'currentTime preserved across the policy pause');
  assert.equal(controller.stats.playheadResets, 0);
  return `faded ${THEME_MUSIC.fadeMs}ms -> paused, playhead held at ${before}s`;
});

// ── D. Lucky Draw -> allowed surface ─────────────────────────────────────────
gate('D-lucky-draw-to-allowed-resumes-same-playhead-with-fade-in', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(63.9);
  const before = media.currentTime;
  controller.setSurface('lucky-draw');
  clock.settle();
  assert.equal(media.paused, true);
  controller.setSurface('bot-pick');
  // Fade-IN must be a ramp, not an instant jump to full volume.
  clock.tick(2);
  assert.ok(media.volume > 0 && media.volume < THEME_MUSIC.targetVolume,
    `expected a mid-fade-in volume, got ${media.volume}`);
  clock.settle();
  assert.equal(media.paused, false);
  assert.equal(media.volume, THEME_MUSIC.targetVolume);
  assert.equal(media.currentTime, before, 'resumed from the SAME preserved playhead');
  return `resumed at ${before}s with fade-in`;
});

gate('repeated-navigation-does-not-accumulate-timers', () => {
  const { controller, clock } = makeHarness('home');
  for (let i = 0; i < 12; i++) {
    controller.setSurface(i % 2 ? 'lucky-draw' : 'home');
    clock.settle();
  }
  assert.equal(clock.liveTimers(), 0, 'no leaked fade timers after 12 navigations');
  return `0 live timers after 12 round trips (${clock.created()} created, all settled)`;
});

gate('reversing-a-fade-mid-transition-is-stable', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(10);
  controller.setSurface('lucky-draw');
  clock.tick(4);
  const midFade = media.volume;
  // Reverse before the fade completes.
  controller.setSurface('bot-pick');
  clock.settle();
  assert.ok(midFade > 0 && midFade < THEME_MUSIC.targetVolume);
  assert.equal(media.volume, THEME_MUSIC.targetVolume, 'reversal settles at full volume');
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 10, 'reversal never moved the playhead');
  assert.equal(clock.liveTimers(), 0, 'the superseded ramp was cancelled, not left running');
  return `mid-fade ${midFade.toFixed(3)} -> reversed cleanly to ${media.volume}`;
});

// ── E. Fighter Shop ──────────────────────────────────────────────────────────
gate('E-fighter-shop-policy-pauses-theme', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(12.5);
  const before = media.currentTime;
  controller.setSurface('fighter-shop');
  clock.settle();
  assert.equal(media.paused, true);
  assert.equal(media.volume, 0);
  assert.equal(media.currentTime, before, 'Shop pause preserves the playhead too');
  return `Shop paused, playhead held at ${before}s`;
});

gate('E-fighter-shop-is-lightly-locked-in-production-graph', () => {
  // §5: the stale ACTIVE Shop must be corrected, while its route and unlock
  // path are preserved (not deleted).
  const surface = getProductSurface('fighter-shop');
  assert.ok(surface, 'Fighter Shop must still exist in the product graph');
  assert.equal(surface.availability, PRODUCT_AVAILABILITY.LOCKED,
    'Fighter Shop must be lightly locked for the Gold cutover');
  assert.notEqual(surface.availability, PRODUCT_AVAILABILITY.ACTIVE, 'stale ACTIVE Shop must be gone');
  assert.equal(surface.route, 'shop', 'route preserved for future unlock');
  assert.equal(themePolicyFor('fighter-shop'), THEME_DECISION.PAUSE,
    'music policy stays declared so a later unlock needs no audio rewrite');
  return 'LOCKED, route "shop" preserved, music policy PAUSE declared';
});

// ── F. Fighter Upgrade / Missions ────────────────────────────────────────────
gate('F-locked-surfaces-still-declare-music-off-policy', () => {
  const table = themeSurfacePolicyTable();
  for (const id of ['fighter-upgrade', 'missions', 'mission', 'lucky-draw', 'fighter-shop', 'quest-01']) {
    assert.equal(table[id], THEME_DECISION.PAUSE, `${id} must be declared music-OFF`);
  }
  // Their product state is LOCKED, yet the audio policy is already correct —
  // unlocking later must not require rewriting the audio manager.
  for (const id of ['fighter-upgrade', 'missions']) {
    assert.equal(getProductSurface(id)?.availability, PRODUCT_AVAILABILITY.LOCKED);
    assert.equal(themePolicyFor(id), THEME_DECISION.PAUSE);
  }
  return 'music-off declared for upgrade/missions/draw/shop/quest while surfaces stay LOCKED';
});

gate('unknown-surface-defaults-to-continuous-music', () => {
  // A future surface is music-continuous unless explicitly excepted, so adding
  // a product surface cannot silently mute the theme.
  assert.equal(themePolicyFor('some-future-surface'), THEME_DECISION.PLAY);
  assert.equal(themePolicyFor(''), THEME_DECISION.PLAY);
  return 'default policy is PLAY';
});

// ── G. Pick -> battle-entry ──────────────────────────────────────────────────
gate('G-pick-to-battle-entry-keeps-theme-running', () => {
  const { controller, media, clock, advance } = makeHarness('local-pick');
  advance(88.4);
  const before = media.currentTime;
  // Entering the battle-entry transition/handoff is NOT the match start.
  controller.setSurface('battle-entry');
  clock.settle();
  assert.equal(media.paused, false, 'theme continues through the entry presentation');
  assert.equal(media.currentTime, before);
  assert.equal(controller.decision(), THEME_DECISION.PLAY);
  return `theme continues through battle-entry at ${before}s`;
});

// ── H. actual match start ────────────────────────────────────────────────────
gate('H-match-start-fades-out-exactly-once-with-no-race', () => {
  const { controller, media, clock, advance } = makeHarness('battle-entry');
  advance(120.7);
  const before = media.currentTime;
  controller.enterBattleMatch();
  const fadesAtStart = controller.stats.fadesStarted;
  // A late/duplicate entry attempt must not start a second audible ramp.
  controller.enterBattleMatch();
  clock.settle();
  assert.equal(media.paused, true, 'theme paused at the real match start');
  assert.equal(media.volume, 0);
  assert.equal(media.currentTime, before, 'match start preserves the playhead for the return flow');
  assert.equal(controller.stats.fadesStarted, fadesAtStart + 1,
    'exactly one fade — a repeated match-start seam must not stack ramps');
  assert.equal(clock.liveTimers(), 0, 'no ramp left racing the battle session');
  return `one fade, paused, playhead held at ${before}s, 0 racing timers`;
});

gate('H-superseded-resume-cannot-race-battle-start', () => {
  const { controller, media, clock, advance } = makeHarness('home');
  advance(30);
  // Start a fade-IN, then start the match before it settles.
  controller.setSurface('bot-pick');
  clock.tick(2);
  controller.enterBattleMatch();
  clock.settle();
  assert.equal(media.paused, true, 'battle start wins');
  assert.equal(media.volume, 0, 'the abandoned ramp must not write a stale volume');
  return 'in-flight resume abandoned by the generation token';
});

// ── I. result/return ─────────────────────────────────────────────────────────
gate('I-result-return-resumes-same-preserved-playhead', () => {
  const { controller, media, clock, advance } = makeHarness('battle-entry');
  advance(120.7);
  const heldAt = media.currentTime;
  controller.enterBattleMatch();
  clock.settle();
  assert.equal(media.paused, true);
  // Simulate the match running while the theme is paused: the playhead must
  // NOT advance and must NOT be reset.
  assert.equal(media.currentTime, heldAt);
  controller.setSurface('result');
  clock.settle();
  assert.equal(media.paused, false, 'result/return is a policy-allowed surface');
  assert.equal(media.currentTime, heldAt, 'resumed from the same preserved playhead');
  assert.equal(controller.stats.playheadResets, 0);
  return `held at ${heldAt}s through the match, resumed there`;
});

// ── J. blur / hidden ─────────────────────────────────────────────────────────
gate('J-hidden-tab-silences-theme-and-resumes-same-playhead', () => {
  const { controller, media, clock, advance } = makeHarness('bot-pick');
  advance(55.25);
  const before = media.currentTime;
  controller.setSuppressed(true);
  clock.settle();
  assert.equal(media.paused, true, 'audible theme stops when hidden');
  assert.equal(media.volume, 0);
  assert.equal(media.currentTime, before, 'blur/visibility pause never resets currentTime');
  controller.setSuppressed(false);
  clock.settle();
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, before, 'resumed from the SAME playhead');
  return `hidden -> silent, focus -> resumed at ${before}s`;
});

gate('J-focus-resume-still-respects-mute-and-policy', () => {
  // Visible + focused is not sufficient: mute and surface policy are
  // independent gates on the resume.
  const mutedCase = makeHarness('bot-pick');
  mutedCase.controller.setMuted(true);
  mutedCase.clock.settle();
  mutedCase.controller.setSuppressed(true);
  mutedCase.clock.settle();
  mutedCase.controller.setSuppressed(false);
  mutedCase.clock.settle();
  assert.equal(mutedCase.media.paused, true, 'M-mute blocks the focus resume');

  const policyCase = makeHarness('lucky-draw');
  policyCase.controller.setSuppressed(true);
  policyCase.clock.settle();
  policyCase.controller.setSuppressed(false);
  policyCase.clock.settle();
  assert.equal(policyCase.media.paused, true, 'a music-OFF surface blocks the focus resume');
  return 'focus resume requires unmuted AND policy-allowed';
});

// ── K. M key ─────────────────────────────────────────────────────────────────
gate('K-m-mute-preserves-playhead', () => {
  const { controller, media, clock, advance } = makeHarness('bot-pick');
  advance(31.75);
  const before = media.currentTime;
  assert.equal(controller.handlesKey('m'), true);
  assert.equal(controller.handlesKey('M'), true, 'key matching is case-insensitive');
  controller.setMuted(true);
  clock.settle();
  assert.equal(media.paused, true);
  assert.equal(media.volume, 0, 'mute fades out rather than hard-cutting');
  assert.equal(media.currentTime, before, 'mute preserves the playhead');
  return `muted, playhead held at ${before}s`;
});

gate('K-m-unmute-resumes-same-playhead-when-allowed', () => {
  const { controller, media, clock, advance } = makeHarness('bot-pick');
  advance(31.75);
  const before = media.currentTime;
  controller.setMuted(true);
  clock.settle();
  controller.setMuted(false);
  clock.settle();
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, before, 'unmute resumes the SAME playhead');
  assert.equal(media.volume, THEME_MUSIC.targetVolume);
  return `unmuted at ${before}s`;
});

gate('K-m-unmute-while-on-music-off-surface-stays-paused', () => {
  const { controller, media, clock, advance } = makeHarness('lucky-draw');
  advance(20);
  controller.setMuted(true);
  clock.settle();
  controller.setMuted(false);
  clock.settle();
  assert.equal(media.paused, true, 'unmute must not override surface policy');
  assert.equal(controller.isMuted(), false);
  return 'unmute respects surface policy';
});

// Comment-stripper: the law is about executable code, not documentation. The
// module legitimately documents that it creates no AudioContext, so a naive
// substring check would fail on its own explanatory comment.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

gate('K-m-does-not-affect-battle-sfx-or-audio-graph', () => {
  const theme = stripComments(fs.readFileSync('src/game/themeMusic.js', 'utf8'));
  // §4.6: no new AudioContext, no routing into the battle master, and no
  // clearing of decoded battle SFX when the theme pauses.
  for (const banned of ['AudioContext', 'webkitAudioContext', 'battleAudioMaster',
    'apexBattleAudio', 'decodeAudioData', 'resetAudioSession']) {
    assert.ok(!theme.includes(banned), `theme module must not reference ${banned}`);
  }
  assert.ok(stripComments(fs.readFileSync('src/App.jsx', 'utf8')).match(/new Audio\(/g).length === 1,
    'exactly one HTMLMediaElement and therefore no competing AudioContext owner');
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  const mBlock = app.slice(app.indexOf('const handleMusicKey'), app.indexOf("window.addEventListener('pointerdown', unlock)"));
  assert.ok(mBlock.includes('toggleMuted'), 'M handler toggles music mute');
  for (const banned of ['apexBeginBattleAudioSession', 'apexEndBattleAudioSession',
    'battleAudioMaster', 'setMode', '1p', '2p']) {
    assert.ok(!mBlock.includes(banned), `M handler must not touch ${banned}`);
  }
  return 'M is music-only: no battle-audio or mode coupling';
});

gate('K-m-does-not-toggle-bot-local-mode', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  // The Battle HUD donor's demo-only "M = toggle 1P/2P" binding must not
  // survive production, and no synthetic key event may be used to change mode.
  for (const banned of ["S.mode=S.mode==='2p'", "mode==='2p'", 'dispatchEvent(new KeyboardEvent',
    'apexSetGameMode', 'toggleMode()']) {
    assert.ok(!app.includes(banned), `donor demo M semantic leaked: ${banned}`);
  }
  const trigger = fs.readFileSync('public/game/ui/apexCombatHudTriggerRuntime.js', 'utf8');
  assert.ok(!/'m'|"m"/.test(trigger), 'trigger authority must not bind any key');
  // BOT/Local mode comes from real product state, not a hotkey.
  const graph = fs.readFileSync('src/game/productSurface.js', 'utf8');
  assert.ok(graph.includes("'bot-battle'") && graph.includes("'local-1v1'"),
    'BOT/Local remain product-graph surfaces');
  return 'no M->mode binding anywhere in production; mode stays product state';
});

// ── Shipping / offline law ───────────────────────────────────────────────────
gate('theme-asset-is-materialized-locally-with-expected-hash', () => {
  const rel = 'public/assets/music/forward_drive_theme.ogg';
  assert.ok(fs.existsSync(rel), `${rel} must exist as a stable runtime path`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(rel)).digest('hex');
  assert.equal(digest, THEME_MUSIC.runtimeSha256, 'materialized theme hash must match the preload authority');
  assert.equal(THEME_MUSIC.src, '/assets/music/forward_drive_theme.ogg');
  assert.ok(!THEME_MUSIC.src.includes('.zip'), 'runtime must never depend on the preload ZIP');
  return `sha256 ${digest.slice(0, 16)}... matches preload authority`;
});

gate('fade-duration-is-within-owner-band', () => {
  assert.ok(THEME_MUSIC.fadeMs >= 300 && THEME_MUSIC.fadeMs <= 450,
    `fade ${THEME_MUSIC.fadeMs}ms outside the accepted 300–450ms band`);
  assert.equal(THEME_MUSIC.muteKey, 'm');
  assert.equal(THEME_MUSIC.loop, true, 'a loop boundary is allowed and is not a restart');
  return `${THEME_MUSIC.fadeMs}ms single production fade constant`;
});

gate('legacy-menu-bgm-is-replaced-not-duplicated', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  assert.ok(!app.includes('menu_bgm.mp3'), 'legacy menu-only BGM must be gone');
  assert.ok(!/stopMenuMusic\(true\)|playMenuMusic\(true\)/.test(app),
    'no reset/restart argument may survive');
  // One element, one controller: no second music engine.
  assert.equal((app.match(/new Audio\(/g) || []).length, 1, 'exactly one HTMLMediaElement');
  assert.equal((app.match(/createThemeMusicController\(/g) || []).length, 1, 'exactly one controller');
  const pick = fs.readFileSync('public/game/ui/apexPickRuntime.js', 'utf8');
  assert.ok(!/apexPlayMenuMusic\?\.\(true\)|apexStopMenuMusic\?\.\(true\)/.test(pick),
    'Pick runtime must not carry reset-semantics music calls');
  const battle = fs.readFileSync('public/game/modes/arsenalBattleRuntime.js', 'utf8');
  assert.ok(!/apexPlayMenuMusic\?\.\(true\)/.test(battle),
    'battle runtime must not restart the theme on mode exit');
  return 'one element, one controller, zero reset-semantics callers';
});

const passed = Object.values(report.gates).filter((g) => g.pass).length;
const total = Object.values(report.gates).length;
console.log(`\n${passed}/${total} gates passed`);
if (report.failures.length) console.error('FAILED:', report.failures.join(', '));
process.exitCode = report.failures.length ? 1 : 0;
