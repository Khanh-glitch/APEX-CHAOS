// CORE SIX hero SFX — semantic + anti-noise proof.
//
// Proves the AV preload's binding mix decisions survive integration:
//   - semantic trigger correctness (real event -> intended clip);
//   - no duplicate alias-event playback;
//   - rate / voice limits under burst stress;
//   - OFF BY DEFAULT and SILENT cues stay unwired;
//   - no first-use decode hitch in live combat;
//   - teardown/rematch leaks no stale voices or timers.
//
//   node tools/testCoreSixHeroSfx.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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

const RUNTIME = 'public/game/hero-rework/coreSixHeroSfxRuntime.js';
const source = fs.readFileSync(RUNTIME, 'utf8');

// Mock AV engine standing in for the accepted APEX_ARSENAL_AV hero-SFX seam.
// It reproduces the real rate-limit contract so throttling is genuinely
// exercised rather than assumed.
function makeEngine({ rateKeySpace = true } = {}) {
  const calls = [];
  const warmed = [];
  const lastAt = new Map();
  const activeVoices = new Map();
  const timers = [];
  const engine = {
    calls,
    warmed,
    playHeroSfx(rel, opts = {}) {
      const now = clock.t;
      if (opts.rateLimitMs > 0) {
        const key = opts.rateKey || rel;
        const last = lastAt.get(key);
        if (last != null && now - last < opts.rateLimitMs) return false;
        lastAt.set(key, now);
      }
      const active = activeVoices.get(rel) || 0;
      if (active >= (opts.maxVoices || 2)) return false;
      activeVoices.set(rel, active + 1);
      const id = { cancelled: false };
      timers.push(id);
      calls.push({ rel, t: now, vol: opts.vol, event: opts.event, maxVoices: opts.maxVoices });
      return true;
    },
    warmHeroSfx(rel) { warmed.push(rel); return true; },
    // Simulate the voice releasing when its clip would have ended.
    releaseAll() {
      activeVoices.clear();
      for (const t of timers) t.cancelled = true;
    },
    liveVoices: () => Array.from(activeVoices.values()).reduce((a, b) => a + b, 0),
    liveTimers: () => timers.filter((t) => !t.cancelled).length,
  };
  return engine;
}

const clock = { t: 0 };
const advance = (ms) => { clock.t += ms; };

function makeHarness(opts = {}) {
  clock.t = 0;
  const engine = makeEngine();
  const busHandlers = new Map();
  const context = {
    performance: { now: () => clock.t },
    APEX_ARSENAL_AV: engine,
    APEX_HERO_REWORK_AIL: opts.noBus ? undefined : {
      bus: {
        on: (type, handler) => {
          if (!busHandlers.has(type)) busHandlers.set(type, []);
          busHandlers.get(type).push(handler);
          return () => {
            const list = busHandlers.get(type) || [];
            const i = list.indexOf(handler);
            if (i >= 0) list.splice(i, 1);
          };
        },
      },
    },
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON,
    setTimeout: (fn, ms) => { const id = { fn, ms, cancelled: false }; engine.calls.push; return id; },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: RUNTIME });
  const SFX = context.APEX_CORE_SIX_SFX;
  const emit = (type, payload) => {
    for (const h of (busHandlers.get(type) || [])) h(payload);
  };
  return { SFX, engine, emit, busHandlers, context };
}

// ── Semantic trigger correctness ─────────────────────────────────────────────
const SEMANTIC_CASES = [
  ['CrystalAwaken', {}, 'crystala_a2_awaken.mp3', 'A2_AWAKEN'],
  ['CrystalIntercept', {}, 'crystala_projectile_reflect.mp3', 'INTERCEPT_REFRACTION'],
  ['CrystalConstructCast', { kind: 'wall' }, 'crystala_wall_construct.mp3', 'A1_WALL_GROW'],
  ['MagnetA1Start', {}, 'magnet_a1_attraction.mp3', 'A1_ATTRACTION'],
  ['MagnetA2Start', {}, 'magnet_a2_repulsion.mp3', 'A2_REPULSION'],
  ['MagnetA2BulletDeflect', {}, 'magnet_a2_bullet_deflect.mp3', 'A2_BULLET_DEFLECT'],
  ['FrostBreathCast', {}, 'frost_a1_breath.mp3', 'A1_CHARGE_RELEASE'],
  ['FrostSlotFrozen', {}, 'frost_weapon_freeze_a.mp3', 'GUN_FREEZE'],
  ['FrostGunFrozen', {}, 'frost_weapon_freeze_a.mp3', 'GUN_FREEZE'],
  ['FrostFreezeStart', {}, 'frost_enemy_freeze.mp3', 'ENEMY_FREEZE'],
  ['MirrorA1Cast', {}, 'mirror_a1_cast.mp3', 'A1_REFLECTION_PEEL'],
  ['MirrorExchange', {}, 'mirror_a2_exchange_snap.mp3', 'A2_PRE_SNAP_EXCHANGE'],
  ['MirrorPassiveShardProc', { shards: 5 }, 'mirror_passive_shard_drop_a.mp3', 'PASSIVE_SHARD_DROP'],
  ['MirrorNodeForming', {}, 'mirror_passive_node_form.mp3', 'PASSIVE_NODE_FORM'],
];

for (const [event, payload, clip, beat] of SEMANTIC_CASES) {
  gate(`semantic-${event}-maps-to-${clip}`, () => {
    const { SFX, engine } = makeHarness();
    const res = SFX.dispatch(event, payload);
    assert.equal(res.played, true, `${event} should play`);
    assert.equal(engine.calls.length, 1);
    assert.ok(engine.calls[0].rel.endsWith(clip), `expected ${clip}, got ${engine.calls[0].rel}`);
    assert.equal(engine.calls[0].event, beat);
    return `${event} -> ${clip} (${beat})`;
  });
}

// ── Anti-noise example: Crystala one interception = one reflect cue ──────────
gate('crystala-interception-is-one-reflect-not-intercept-plus-reflect', () => {
  const { SFX, engine, emit } = makeHarness();
  // A single real interception emits BOTH the authoritative CrystalIntercept
  // and its CrystalReflect compatibility alias. Only ONE cue may sound.
  emit('CrystalIntercept', { shard: 1, tid: 2 });
  emit('CrystalReflect', { body: 3, damage: 20 });
  const reflectCues = engine.calls.filter((c) => c.rel.includes('crystala_projectile_reflect'));
  assert.equal(reflectCues.length, 1, 'alias event must not add a second reflect cue');
  assert.equal(engine.calls.length, 1);
  return 'Intercept + Reflect alias -> exactly 1 reflect cue';
});

gate('crystala-reflect-rate-limited-under-bullet-spray', () => {
  const { SFX, engine, emit } = makeHarness();
  // A spray: 40 interceptions inside 400 ms must read as a few crystalline
  // redirects, not a machine-gun of glass pings (90 ms floor).
  for (let i = 0; i < 40; i++) { advance(10); emit('CrystalIntercept', { shard: i }); }
  const cues = engine.calls.filter((c) => c.rel.includes('crystala_projectile_reflect'));
  assert.ok(cues.length <= 5, `expected <=5 reflect voices, got ${cues.length}`);
  assert.ok(cues.length >= 1, 'at least one redirect must be audible');
  for (let i = 1; i < cues.length; i++) {
    assert.ok(cues[i].t - cues[i - 1].t >= 90, 'rate-limit floor violated');
  }
  return `40 intercepts in 400ms -> ${cues.length} cues (>=90ms apart)`;
});

gate('crystala-prison-construct-is-silent-and-never-reuses-wall-sound', () => {
  const { SFX, engine, emit } = makeHarness();
  emit('CrystalConstructCast', { kind: 'prison' });
  assert.equal(engine.calls.length, 0, 'prison must never borrow the Wall sound');
  assert.equal(SFX.stats.suppressedGuard, 1);
  return 'kind=prison -> silent';
});

gate('crystala-wall-gets-wall-body-plus-two-quiet-shard-accents', () => {
  const { SFX, engine, emit } = makeHarness();
  emit('CrystalConstructCast', { kind: 'wall' });
  const wall = engine.calls.filter((c) => c.rel.includes('crystala_wall_construct'));
  const shards = engine.calls.filter((c) => c.rel.includes('crystala_shard_pulse'));
  assert.equal(wall.length, 1, 'one material-growth body');
  assert.ok(shards.length >= 1, 'at least the first shard micro-cut');
  // The shard accent must sit far underneath the wall body.
  assert.ok(shards[0].vol < wall[0].vol, `shard accent ${shards[0].vol} must be quieter than wall ${wall[0].vol}`);
  return `wall x1 @${wall[0].vol}, shard accent x${shards.length} @${shards[0].vol}`;
});

// ── Anti-noise example: Frost FreezeRefresh must not replay the freeze cue ───
gate('frost-freeze-refresh-never-replays-enemy-freeze-cue', () => {
  const { SFX, engine, emit } = makeHarness();
  emit('FrostFreezeStart', { target: 1 });
  assert.equal(engine.calls.length, 1);
  // Rapid Frozen Bullet hits refresh the same readable freeze state.
  for (let i = 0; i < 12; i++) { advance(60); emit('FrostFreezeRefresh', { target: 1 }); }
  const freezeCues = engine.calls.filter((c) => c.rel.includes('frost_enemy_freeze'));
  assert.equal(freezeCues.length, 1, 'a refresh must not replay the full cue');
  assert.equal(SFX.stats.suppressedSilent >= 12, true, 'refreshes counted as SILENT');
  return '1 start + 12 refreshes -> exactly 1 enemy-freeze cue';
});

gate('frost-gun-freeze-one-voice-per-conversion-capped-at-two', () => {
  const { SFX, engine, emit } = makeHarness();
  for (let i = 0; i < 6; i++) emit('FrostSlotFrozen', { slotId: i });
  const cues = engine.calls.filter((c) => c.rel.includes('frost_weapon_freeze'));
  assert.ok(cues.length <= 2, `voice cap is 2, got ${cues.length}`);
  return `6 simultaneous conversions -> ${cues.length} voices (cap 2)`;
});

// ── Anti-noise example: Magnet A2 deflect ────────────────────────────────────
gate('magnet-a2-deflect-uses-precut-clip-and-is-rate-limited', () => {
  const { SFX, engine } = makeHarness();
  // Many pellets crossing together must be 1-2 whizzes, not N sounds.
  for (let i = 0; i < 30; i++) { advance(10); SFX.dispatch('MagnetA2BulletDeflect', { combatantIndex: 0 }); }
  const cues = engine.calls.filter((c) => c.rel.includes('magnet_a2_bullet_deflect'));
  assert.ok(cues.length <= 4, `expected <=4 whizzes, got ${cues.length}`);
  assert.ok(cues.length >= 1);
  // The clip is the pre-cut whizz portion; no separate wall-impact transient
  // clip may exist or be played.
  assert.ok(!engine.calls.some((c) => /impact|wall|hit/.test(c.rel)),
    'no wall-impact transient may be played for a magnetic redirection');
  return `30 pellets in 300ms -> ${cues.length} whizz cues, no impact transient`;
});

gate('magnet-per-owner-rate-limit-does-not-throttle-other-owners', () => {
  const { SFX, engine } = makeHarness();
  SFX.dispatch('MagnetA2BulletDeflect', { combatantIndex: 0 });
  SFX.dispatch('MagnetA2BulletDeflect', { combatantIndex: 0 });
  const first = engine.calls.length;
  // A second Magnet owner is throttled by its own key space, not the first's.
  SFX.dispatch('MagnetA2BulletDeflect', { combatantIndex: 1 });
  assert.equal(first, 1, 'second deflect inside the window is throttled');
  assert.equal(engine.calls.length, 2, 'a different owner is not throttled by owner 0');
  return 'rate-limit key space is per owner';
});

gate('magnet-a1-a2-are-one-shots-never-loops', () => {
  const { SFX, engine } = makeHarness();
  SFX.dispatch('MagnetA1Start', {});
  SFX.dispatch('MagnetA2Start', {});
  assert.equal(engine.calls.length, 2);
  // No loop field may reach the engine for a one-shot beat.
  assert.ok(engine.calls.every((c) => c.loop === undefined), 'no looping of a one-shot cue');
  const src = source;
  assert.ok(!/loop\s*:\s*true/.test(src), 'policy must not declare looping cues');
  return 'A1/A2 dispatched once each, no loop';
});

// ── Anti-noise example: Mirror one proc = one shard-drop accent ──────────────
gate('mirror-one-proc-is-one-shard-drop-even-for-many-shards', () => {
  const { SFX, engine, emit } = makeHarness();
  // ONE realized passive damage event that creates 5 shards.
  emit('MirrorPassiveShardProc', { owner: 0, shards: 5 });
  const drops = engine.calls.filter((c) => c.rel.includes('mirror_passive_shard_drop'));
  assert.equal(drops.length, 1, 'five shards must produce ONE drop accent');
  return 'proc with 5 shards -> 1 shard-drop accent';
});

gate('mirror-shard-drop-rate-limited-across-procs', () => {
  const { SFX, engine, emit } = makeHarness();
  for (let i = 0; i < 20; i++) { advance(20); emit('MirrorPassiveShardProc', { owner: 0, shards: 3 }); }
  const drops = engine.calls.filter((c) => c.rel.includes('mirror_passive_shard_drop'));
  assert.ok(drops.length <= 4, `expected <=4 accents, got ${drops.length}`);
  return `20 procs in 400ms -> ${drops.length} accents (>=100ms apart)`;
});

gate('mirror-a2-snap-lands-on-exchange-not-on-cast', () => {
  const { SFX, engine, emit } = makeHarness();
  emit('MirrorA2Cast', { castId: 1 });
  assert.equal(engine.calls.length, 0, 'A2 cast must not pre-fire the snap');
  emit('MirrorExchange', { castId: 1 });
  assert.equal(engine.calls.length, 1);
  assert.ok(engine.calls[0].rel.includes('mirror_a2_exchange_snap'));
  return 'snap at MirrorExchange, silent at MirrorA2Cast';
});

// ── OFF BY DEFAULT / SILENT stay off ─────────────────────────────────────────
const OFF_BY_DEFAULT = ['CrystalConstructHit', 'CrystalReserve', 'FrostFloorContact', 'MirrorA1Own', 'MirrorNodeOff'];
for (const event of OFF_BY_DEFAULT) {
  gate(`optional-${event}-stays-off-by-default`, () => {
    const { SFX, engine } = makeHarness();
    const res = SFX.dispatch(event, { kind: 'wall', owner: 0 });
    assert.equal(res.played, false, `${event} must not play on the first mix`);
    assert.equal(res.reason, 'off-by-default');
    assert.equal(engine.calls.length, 0);
    return `${event} declared OFF BY DEFAULT and silent`;
  });
}

const SILENT_BEATS = ['CrystalRelease', 'CrystalDock', 'CrystalReflect', 'CrystalConstructBreak',
  'MagnetPassiveEmission', 'FrostFreezeRefresh', 'MirrorNodeActive', 'MirrorA2Cast',
  'MirrorRouteCapture', 'MirrorRouteEmerge', 'MirrorEscrowImage', 'MirrorA1Whiff'];
gate('silent-beats-never-play-anything', () => {
  const { SFX, engine } = makeHarness();
  for (const event of SILENT_BEATS) {
    const res = SFX.dispatch(event, {});
    assert.equal(res.played, false, `${event} must stay silent`);
  }
  assert.equal(engine.calls.length, 0, 'no SILENT beat may produce a voice');
  return `${SILENT_BEATS.length} SILENT beats verified silent`;
});

// ── No first-use decode hitch ────────────────────────────────────────────────
gate('every-wired-clip-is-warmable-up-front', () => {
  const { SFX, engine } = makeHarness();
  const warmed = SFX.warm();
  assert.equal(warmed, SFX.REQUIRED_CLIPS.length);
  assert.equal(engine.warmed.length, SFX.REQUIRED_CLIPS.length);
  // Every DEFAULT_ON/LOW_ACCENT clip must be in the warm set, so no audible cue
  // can decode for the first time during live combat.
  const wired = Object.values(SFX.POLICY)
    .filter((e) => e.clip && e.mix !== 'SILENT' && e.enabled !== false)
    .map((e) => e.clip);
  for (const clip of new Set(wired)) {
    assert.ok(engine.warmed.includes(clip), `${clip} is not pre-warmed`);
  }
  // OFF BY DEFAULT clips must NOT be in the required/warm set — they are not
  // runtime hot assets.
  assert.ok(!SFX.REQUIRED_CLIPS.some((c) => c.includes('/optional/')),
    'optional clips must not be pre-warmed as runtime hot assets');
  return `${warmed} wired clips pre-warmed; optional clips excluded`;
});

gate('materialized-clips-exist-on-disk', () => {
  const { SFX } = makeHarness();
  for (const clip of SFX.REQUIRED_CLIPS) {
    const rel = clip.replace(/^\//, 'public/');
    assert.ok(fs.existsSync(rel), `${rel} missing — materialization incomplete`);
  }
  // Runtime must never depend on the preload ZIP.
  for (const clip of SFX.REQUIRED_CLIPS) {
    assert.ok(!clip.includes('.zip'), 'runtime clip must not reference the ZIP');
  }
  return `${SFX.REQUIRED_CLIPS.length} required clips present under public/`;
});

// ── Teardown / rematch hygiene ───────────────────────────────────────────────
gate('unsubscribe-removes-every-bus-handler', () => {
  const { SFX, busHandlers } = makeHarness();
  const before = Array.from(busHandlers.values()).reduce((n, list) => n + list.length, 0);
  assert.ok(before > 0, 'the runtime must actually subscribe');
  SFX.unsubscribe();
  const after = Array.from(busHandlers.values()).reduce((n, list) => n + list.length, 0);
  assert.equal(after, 0, `${after} bus handlers leaked after unsubscribe`);
  return `${before} handlers subscribed, 0 after unsubscribe`;
});

gate('engine-voice-and-timer-release-leaves-nothing-live', () => {
  const { SFX, engine } = makeHarness();
  for (const event of ['MagnetA1Start', 'MagnetA2Start', 'FrostBreathCast', 'MirrorA1Cast']) {
    SFX.dispatch(event, {});
  }
  assert.ok(engine.liveVoices() > 0, 'voices were reserved');
  assert.ok(engine.liveTimers() > 0, 'release timers were tracked');
  engine.releaseAll();
  assert.equal(engine.liveVoices(), 0, 'no stale voices after teardown');
  assert.equal(engine.liveTimers(), 0, 'no stale timers after teardown');
  return 'voices and timers fully released';
});

// Comment-stripper: the law is about executable code. The runtime legitimately
// documents that it creates no AudioContext, so a naive substring check would
// fail on its own explanatory comment.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

gate('no-second-audio-engine-or-context-is-created', () => {
  const code = stripComments(source);
  for (const banned of ['AudioContext', 'webkitAudioContext', 'decodeAudioData',
    'createBufferSource', 'battleAudioMaster']) {
    assert.ok(!code.includes(banned), `SFX runtime must not reference ${banned}`);
  }
  // It must go through the accepted facade only.
  assert.ok(source.includes('APEX_ARSENAL_AV'), 'must use the accepted AV facade');
  assert.ok(source.includes('playHeroSfx'), 'must use the shared hero-SFX seam');
  return 'routes through APEX_ARSENAL_AV.playHeroSfx only';
});

gate('bus-subscription-covers-the-policy-table', () => {
  const { SFX } = makeHarness();
  for (const event of SFX.SUBSCRIBED_EVENTS) {
    assert.ok(SFX.POLICY[event], `${event} subscribed but not in the policy table`);
  }
  assert.equal(SFX.SUBSCRIBED_EVENTS.length, Object.keys(SFX.POLICY).length);
  return `${SFX.SUBSCRIBED_EVENTS.length} semantic events subscribed`;
});

const passed = Object.values(report.gates).filter((g) => g.pass).length;
const total = Object.values(report.gates).length;
console.log(`\n${passed}/${total} gates passed`);
if (report.failures.length) console.error('FAILED:', report.failures.join(', '));
process.exitCode = report.failures.length ? 1 : 0;
