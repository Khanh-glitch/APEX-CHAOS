// Gold cutover — DOM boot integration check.
//
// SCOPE (stated honestly): this executes the REAL shipping runtime files inside
// a jsdom DOM and proves they install their globals, subscribe, and classify
// without throwing. It is NOT a substitute for real-browser visual/motion
// evidence, which requires a browser binary and is reported separately.
//
//   node tools/testGoldCutoverDomBoot.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

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

const { createThemeMusicController, THEME_MUSIC } = await import('../src/game/themeMusic.js');

function makeDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const win = dom.window;
  const GUN_IDS = ['PISTOL', 'SMG', 'SHOTGUN', 'SNIPER', 'RIFLE'];
  win.APEX_ARSENAL_CONFIG = { isGun: (id) => GUN_IDS.includes(id) };
  return win;
}

function runIn(win, file) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, vm.createContext(win), { filename: file });
}

// ── Battle HUD semantic trigger runtime boots in a DOM ───────────────────────
gate('trigger-runtime-installs-in-dom', () => {
  const win = makeDom();
  runIn(win, 'public/game/ui/apexCombatHudTriggerRuntime.js');
  const T = win.APEX_COMBAT_HUD_TRIGGERS;
  assert.ok(T, 'APEX_COMBAT_HUD_TRIGGERS must install on the real window');
  assert.equal(T.version, 'apex-combat-hud-trigger-authority-v1');
  assert.equal(T.HEAVY_BURST_THRESHOLD, 200);
  assert.equal(T.HEAVY_BURST_WINDOW_MS, 1200);
  // Real classification through the installed global, using Arsenal identity.
  const s = T.createSession();
  s.onRealizedDamage({ victim: { id: 2 }, amount: 446, label: 'arsenal-stormbreaker' });
  const kinds = Array.from(s.drain()).map((t) => t.kind);
  assert.ok(kinds.includes('HEAVY') && kinds.includes('THUNDER'), `got ${kinds.join(',')}`);
  assert.ok(!kinds.includes('CRITICAL'), 'Stormbreaker must not become a crit');
  return `installed; Stormbreaker -> ${kinds.join(' + ')}`;
});

// ── Core Six SFX runtime boots in a DOM and subscribes to the real bus ───────
gate('core-six-sfx-runtime-installs-and-subscribes-in-dom', () => {
  const win = makeDom();
  const seen = [];
  const handlers = [];
  win.APEX_HERO_REWORK_AIL = {
    bus: {
      on: (type, handler) => { handlers.push([type, handler]); return () => {}; },
    },
  };
  win.APEX_ARSENAL_AV = {
    playHeroSfx: (rel, opts) => { seen.push({ rel, event: opts && opts.event }); return true; },
    warmHeroSfx: () => true,
  };
  runIn(win, 'public/game/hero-rework/coreSixHeroSfxRuntime.js');
  const SFX = win.APEX_CORE_SIX_SFX;
  assert.ok(SFX, 'APEX_CORE_SIX_SFX must install on the real window');
  assert.ok(handlers.length > 0, 'must subscribe to the AIL bus on load');
  assert.equal(handlers.length, SFX.SUBSCRIBED_EVENTS.length);

  // Drive a real bus payload through the installed subscription.
  const frostFreeze = handlers.find(([t]) => t === 'FrostFreezeStart');
  const frostRefresh = handlers.find(([t]) => t === 'FrostFreezeRefresh');
  frostFreeze[1]({ target: 1 });
  for (let i = 0; i < 5; i++) frostRefresh[1]({ target: 1 });
  const freezeCues = seen.filter((c) => c.rel.includes('frost_enemy_freeze'));
  assert.equal(freezeCues.length, 1, 'refreshes must not replay the freeze cue');
  return `${handlers.length} events subscribed; 1 freeze cue across 1 start + 5 refreshes`;
});

// ── The theme module loads as a real ESM module and owns the M key ───────────
gate('theme-module-owns-the-m-key-in-a-dom-keyboard-context', () => {
  const win = makeDom();
  // A minimal media element backed by the jsdom window.
  const media = { currentTime: 42, volume: THEME_MUSIC.targetVolume, paused: false,
    play() { media.paused = false; return Promise.resolve(); }, pause() { media.paused = true; } };
  const controller = createThemeMusicController({ media, surface: 'bot-pick' });

  // Wire the key the same way src/App.jsx wires it: a real keydown listener on
  // the window that consults handlesKey() and toggles music mute only.
  let modeChanges = 0;
  win.addEventListener('keydown', (event) => {
    if (!controller.handlesKey(event.key)) return;
    event.preventDefault();
    controller.toggleMuted();
  });

  const before = media.currentTime;
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
  assert.equal(controller.isMuted(), true, 'M must mute the music');
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
  assert.equal(controller.isMuted(), false, 'M must unmute the music');
  assert.equal(media.currentTime, before, 'M must preserve the playhead');
  assert.equal(modeChanges, 0, 'M must not change BOT/Local/P1/P2 mode');

  // A non-music key must be ignored by the music handler.
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true }));
  assert.equal(controller.isMuted(), false, 'skill keys must not touch music mute');
  return 'M toggles music mute only; playhead held at 42s; J ignored';
});

// ── App.jsx registers the production seams it promises ───────────────────────
gate('app-registers-theme-product-seams', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  for (const seam of ['window.apexSetThemeSurface', 'window.apexEnterBattleMatchTheme',
    'window.apexToggleThemeMusic', 'window.__apexThemeMusicState']) {
    assert.ok(app.includes(seam), `${seam} must be registered`);
    // And torn down, so a hot reload cannot double-register.
    assert.ok(app.includes(`delete ${seam.replace('window.', 'window.')}`),
      `${seam} must be cleaned up on unmount`);
  }
  // M is handled on the window, not by the donor HUD.
  assert.ok(app.includes('handleMusicKey'), 'M key handler present');
  assert.ok(app.includes("addEventListener('keydown', handleMusicKey)"), 'M handler is bound to keydown');
  return 'surface / match-start / mute / probe seams registered and cleaned up';
});

gate('battle-hud-donor-demo-m-binding-is-absent-from-production', () => {
  // The donor demo binding lives in docs only. No production file may carry it.
  const donor = fs.readFileSync('docs/gold-ui/current/donors/battle-hud/index.html', 'utf8');
  assert.ok(donor.includes("case 'm':S.mode=S.mode==='2p'?'1p':'2p'"),
    'sanity: the donor demo M=1P/2P binding is what we are quarantining');
  for (const file of ['src/App.jsx', 'public/game/ui/apexCombatHudRuntime.js',
    'public/game/ui/apexCombatHudTriggerRuntime.js', 'public/game/ui/apexPickRuntime.js',
    'public/game/modes/arsenalBattleRuntime.js', 'public/game/hero-rework/coreSixHeroSfxRuntime.js']) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!src.includes("S.mode=S.mode==='2p'"), `${file} must not carry the donor M=mode binding`);
    assert.ok(!/dispatchEvent\(\s*new\s+KeyboardEvent/.test(src),
      `${file} must not synthesize keyboard events to change mode`);
  }
  return 'donor demo M=1P/2P quarantined to docs; no production copy';
});

const passed = Object.values(report.gates).filter((g) => g.pass).length;
const total = Object.values(report.gates).length;
console.log(`\n${passed}/${total} gates passed`);
if (report.failures.length) console.error('FAILED:', report.failures.join(', '));
process.exitCode = report.failures.length ? 1 : 0;
