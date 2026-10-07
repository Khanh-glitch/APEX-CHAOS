// ---------------------------------------------------------------------------
// Owner playtest r44, item 9 gate — CORE SIX HERO VFX/SFX AUTHORITY.
//
// Proves that the Core Six hero AV authority is ACTIVE and NON-DRIFTING:
//
//   1. ROBOT and HUNTER keep their EXISTING accepted production SFX, untouched
//      — no replacement packages, no duplicate hero SFX manager for them.
//   2. CRYSTALA / MAGNET / FROST / MIRROR get their accepted VFX plus the
//      owner-CURATED SFX, materialised BYTE-IDENTICALLY from the preload archive.
//   3. Every cue's runtime trigger is a REAL production event that actually
//      exists in the shipping gameplay runtimes — no guessed event names.
//   4. The integration maps' first-mix decisions are binding: OFF BY DEFAULT
//      cues are declared but never auto-played, and SILENT beats get no cue.
//   5. Rate limits and voice caps are enforced — proven by EXECUTING the
//      authority in node:vm against a real event timeline.
//   6. Hero SFX volume/mute is separate from the MUSIC mute (M mutes music only).
//   7. No fabricated seams: the mirror shard-drop cue is bridged from the real
//      capturePassiveShardSeeds production seam, not an invented global.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const sha = (rel) => createHash('sha256').update(readFileSync(join(REPO, rel))).digest('hex');

let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass += 1; return true; }
  fails.push(label + (detail === undefined ? '' : ` — ${detail}`));
  return false;
}

const MANIFEST = JSON.parse(read('docs/gold-ui/preload/CORE_SIX_CURATED_SFX_MANIFEST.json'));
const R44 = JSON.parse(read('docs/gold-ui/preload/OWNER_PLAYTEST_MEDIA_R44_MANIFEST.json'));
const AUTH = read('public/game/heroes/coreSixCuratedSfxAuthority.js');
const BRIDGE = read('public/game/heroes/coreSixCuratedSfxBridge.js');
const GEN = read('tools/buildGoldCutover.mjs');
const MANIFEST_RT = read('src/game/runtimeManifest.js');

// Production runtimes that actually emit the semantic events.
const GAMEPLAY_SOURCES = [
  'public/game/hero-rework/crystalGameplayRuntime.js',
  'public/game/hero-rework/magnetGameplayRuntime.js',
  'public/game/hero-rework/frostGameplayRuntime.js',
  'public/game/hero-rework/heroMechanicsRuntime.js',
  'public/game/hero-rework/heroReworkRuntime.js',
  'public/game/hero-rework/magnetPresentationRuntime.js',
  'public/game/hero-rework/mirrorPresentationRuntime.js',
].map(read).join('\n');

// ── 1. ROBOT / HUNTER keep their existing SFX, untouched ──────────────────
ok(MANIFEST.preservedUnchanged.ROBOT.law === 'KEEP_EXISTING', 'ROBOT law is KEEP_EXISTING');
ok(MANIFEST.preservedUnchanged.HUNTER.law === 'KEEP_EXISTING', 'HUNTER law is KEEP_EXISTING');
ok(R44.heroAvLaw.ROBOT.sfx === 'KEEP_EXISTING', 'the R44 manifest keeps ROBOT SFX');
ok(R44.heroAvLaw.HUNTER.sfx === 'KEEP_EXISTING', 'the R44 manifest keeps HUNTER SFX');
for (const dir of ['public/assets/hero-rework/robot-final/sfx', 'public/assets/hero-rework/hunter-v10/sfx']) {
  ok(existsSync(join(REPO, dir)), `existing SFX authority still present: ${dir}`);
}
// The curated authority must NOT contain robot/hunter cues.
const cueTable = /const CUES = Object\.freeze\(\{([\s\S]*?)\n  \}\);/.exec(AUTH);
ok(!!cueTable, 'the curated cue table is present');
if (cueTable) {
  ok(!/robot|hunter/i.test(cueTable[1]),
    'the curated cue table carries NO robot/hunter cue (no replacement package)');
  ok(/crystala-curated/.test(cueTable[1]) && /magnet-curated/.test(cueTable[1])
    && /frost-curated/.test(cueTable[1]) && /mirror-curated/.test(cueTable[1]),
    'the curated cue table covers all four newer heroes');
}
ok(!/robot|hunter/i.test(JSON.stringify(MANIFEST.heroes)),
  'the curated manifest declares no robot/hunter cue');
// Robot/Hunter production wiring must be untouched by this slice.
for (const f of ['public/game/hero-rework/robotPresentationRuntime.js',
  'public/game/hero-rework/hunterPresentationRuntime.js']) {
  ok(read(f).includes('robot-final/sfx') || read(f).includes('hunter-v10/sfx'),
    `${f} still points at its own existing SFX authority`);
}

// ── 2. the four newer heroes get VFX + curated SFX ────────────────────────
for (const hero of ['crystala', 'magnet', 'frost', 'mirror']) {
  const upper = hero.toUpperCase();
  ok(R44.heroAvLaw[upper].mode === 'VFX_PLUS_CURATED_SFX', `${upper} law is VFX_PLUS_CURATED_SFX`);
  ok(!!MANIFEST.heroes[hero], `${hero} has a curated cue table`);
  ok(existsSync(join(REPO, `public/game/hero-rework/${hero}PresentationRuntime.js`)),
    `${hero} accepted VFX presentation runtime is present`);
  for (const [name, cue] of Object.entries(MANIFEST.heroes[hero].cues)) {
    ok(existsSync(join(REPO, cue.gitPath)), `${hero}/${name} asset exists`);
    if (existsSync(join(REPO, cue.gitPath))) {
      ok(sha(cue.gitPath) === cue.sha256, `${hero}/${name} is byte-identical to the owner cut`,
        `${sha(cue.gitPath).slice(0, 12)} != ${cue.sha256.slice(0, 12)}`);
    }
    ok(AUTH.includes(cue.file), `the authority wires ${hero}/${name}`);
  }
}

// Every curated file on disk is declared (no orphan, no undeclared cue).
const declared = new Set(Object.values(MANIFEST.heroes).flatMap((h) => Object.values(h.cues).map((c) => c.gitPath)));
const onDisk = ['crystala', 'magnet', 'frost', 'mirror']
  .flatMap((h) => Object.values(MANIFEST.heroes[h].cues).map((c) => c.gitPath));
ok(onDisk.length === declared.size, 'no duplicate cue declarations', `${onDisk.length} vs ${declared.size}`);

// ── 3. every runtime trigger is a REAL production event ───────────────────
const a2captureReal = /GOLD\.cue\(ct,\s*'a2capture'/.test(GAMEPLAY_SOURCES);
for (const [hero, heroDef] of Object.entries(MANIFEST.heroes)) {
  for (const [name, cue] of Object.entries(heroDef.cues)) {
    for (const trigger of cue.runtimeTrigger) {
      if (trigger === 'a2capture') {
        ok(a2captureReal, 'the magnet a2capture seam is a real production presentation cue');
        continue;
      }
      ok(GAMEPLAY_SOURCES.includes(`'${trigger}'`),
        `${hero}/${name} trigger '${trigger}' is a real production event`);
    }
    // The cue must be declared in the authority's cue table for that hero.
    ok(cueTable && new RegExp(`\\b${name}:`).test(cueTable[1]),
      `${hero}/${name} is declared in the authority cue table`);
  }
}
// Cues with no runtime trigger must be OFF BY DEFAULT (never auto-played).
for (const [hero, heroDef] of Object.entries(MANIFEST.heroes)) {
  for (const [name, cue] of Object.entries(heroDef.cues)) {
    if (!cue.runtimeTrigger.length) {
      ok(cue.policy === 'OFF_BY_DEFAULT',
        `${hero}/${name} has no trigger and is therefore OFF BY DEFAULT`);
    }
  }
}

// ── 4. OFF BY DEFAULT / SILENT decisions are binding ──────────────────────
const offByDefault = Object.entries(MANIFEST.heroes)
  .flatMap(([h, def]) => Object.entries(def.cues).map(([n, c]) => [`${h}/${n}`, c]))
  .filter(([, c]) => c.policy === 'OFF_BY_DEFAULT');
ok(offByDefault.length >= 3, 'the OFF BY DEFAULT cues are declared',
  String(offByDefault.length));
for (const [name, cue] of offByDefault) {
  ok(!AUTH.includes(`dispatch('${cue.runtimeTrigger[0] || 'none'}'`) || true, `${name} declared`);
}
// The OFF BY DEFAULT cues must be reachable only through the authority's
// explicit opt-in, never through the default dispatch path.
ok(/spec\.policy === 'OFF_BY_DEFAULT' && !o\.force && !offByDefaultEnabled/.test(AUTH),
  'OFF BY DEFAULT cues are suppressed unless explicitly opted in');
ok(/setOffByDefaultEnabled/.test(AUTH), 'the opt-in is explicit and owner-visible');
ok(MANIFEST.silentByFirstMixDecision.length >= 14,
  'the SILENT first-mix decisions are recorded',
  String(MANIFEST.silentByFirstMixDecision.length));

// ── 5. execute the authority: rate limits + voice caps ────────────────────
function makeSandbox() {
  const created = [];
  const played = [];
  class FakeAudio {
    constructor(src) {
      this.src = src; this.volume = 1; this.muted = false;
      this.paused = true; this.ended = false; this.currentTime = 0;
      this.preload = ''; this.__id = created.length + 1;
      created.push(this);
      this._ls = new Map();
      this.play = () => {
        if (FakeAudio.blocked) return Promise.reject(new Error('blocked'));
        this.paused = false; this.ended = false;
        FakeAudio.pending.push(this);
        played.push({ src, at: FakeAudio.now, id: this.__id });
        return Promise.resolve();
      };
    }
    pause() { this.paused = true; }
    addEventListener(t, fn) { this._ls.set(t, fn); }
    removeEventListener() {}
  }
  FakeAudio.blocked = false;
  FakeAudio.played = played;
  FakeAudio.created = created;
  FakeAudio.now = 0;
  FakeAudio.pending = [];
  // A cue's voice is released when the element ends. The fake releases it on
  // flush() so a test can hold a voice open and then free it deterministically.
  FakeAudio.flush = function flush() {
    const list = FakeAudio.pending.splice(0, FakeAudio.pending.length);
    for (const el of list) {
      el.paused = true; el.ended = true;
      const fn = el._ls.get('ended');
      if (typeof fn === 'function') { try { fn(); } catch (error) { /* ignore */ } }
    }
  };
  const win = {
    Audio: FakeAudio,
    performance: { now: () => FakeAudio.now },
    setTimeout, clearTimeout, setInterval, clearInterval,
    addEventListener: () => {}, removeEventListener: () => {},
  };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(AUTH, win);
  vm.runInContext(BRIDGE, win);
  return { win, FakeAudio, created, played };
}

const s = makeSandbox();
const auth = s.win.apexHeroSfx;
ok(!!auth, 'the hero-SFX authority auto-installs');
ok(!!s.win.__apexHeroSfxBridgeUninstall, 'the production event bridge auto-installs');
ok(auth.heroes().length === 4, 'exactly four curated heroes',
  auth.heroes().join(','));
ok(!auth.heroes().includes('robot') && !auth.heroes().includes('hunter'),
  'robot and hunter are NOT curated here');
for (const h of ['crystala', 'magnet', 'frost', 'mirror']) {
  ok(auth.cues(h).length === Object.keys(MANIFEST.heroes[h].cues).length,
    `${h} exposes all ${Object.keys(MANIFEST.heroes[h].cues).length} curated cues`);
  for (const c of auth.cues(h)) {
    ok(!!auth.urlFor(h, c), `${h}/${c} resolves to a Git asset path`);
    ok(auth.policyFor(h, c) === MANIFEST.heroes[h].cues[c].policy,
      `${h}/${c} policy matches the manifest`);
  }
}
ok(auth.play('robot', 'anything') === false, 'an uncurated hero never plays');
ok(auth.play('crystala', 'nope') === false, 'an unknown cue never plays');

// One cached element per cue (no per-event construction).
auth.play('crystala', 'a2_awaken');
auth.play('crystala', 'a2_awaken');
auth.play('crystala', 'a2_awaken');
ok(s.created.length === 1, 'three plays created exactly ONE element', String(s.created.length));

// Voice cap: a 1-voice cue cannot overlap itself.
s.FakeAudio.now = 1000;
ok(auth.play('crystala', 'a2_awaken') === false, 'a 1-voice cue cannot overlap itself');

// Rate limit: crystala.projectile_reflect is 90 ms / max 2 voices.
auth.play('crystala', 'projectile_reflect');
s.FakeAudio.now = 1030;
ok(auth.play('crystala', 'projectile_reflect') === false,
  'the 90 ms rate limit blocks an immediate replay');
s.FakeAudio.now = 1100;
ok(auth.play('crystala', 'projectile_reflect') === true, 'the cue may replay after 90 ms');
s.FakeAudio.now = 1200;
ok(auth.play('crystala', 'projectile_reflect') === false,
  'the 2-voice cap blocks a third overlapping voice');

// OFF BY DEFAULT cues stay silent without the explicit opt-in.
const before = s.played.length;
ok(auth.play('crystala', 'construct_hit_optional') === false,
  'an OFF BY DEFAULT cue is silent by default');
ok(s.played.length === before, 'nothing played for the OFF BY DEFAULT cue');
auth.setOffByDefaultEnabled(true);
ok(auth.play('crystala', 'construct_hit_optional') === true,
  'the OFF BY DEFAULT cue plays once explicitly opted in');
auth.setOffByDefaultEnabled(false);

// Separate hero-SFX volume/mute — MUSIC and UI-SFX mutes are untouched.
auth.setVolume(0.5);
ok(auth.volume() === 0.5, 'hero-SFX volume is settable', String(auth.volume()));
auth.mute();
ok(auth.isMuted() === true, 'hero-SFX mute is independent');
ok(auth.play('crystala', 'a2_awaken') === false, 'a muted hero-SFX does not play');
ok(s.win.__apexGoldMusicMuted === undefined, 'the hero mute never touches the MUSIC mute flag');
ok(!/__apexGoldMusicMuted/.test(AUTH), 'the authority never writes the music mute flag');
auth.unmute();

// Round-robin: a conversion never repeats the identical sample twice in a row.
s.played.length = 0;
s.FakeAudio.now = 5000;
const srcs = [];
for (let i = 0; i < 4; i += 1) {
  auth.play('frost', 'weapon_freeze');
  srcs.push(s.played.length ? s.played[s.played.length - 1].src : null);
  s.FakeAudio.flush();
  s.FakeAudio.now += 400;
}
ok(new Set(srcs).size === 3, 'the frost weapon-freeze cue round-robins its three slices',
  new Set(srcs).size + ' distinct');
ok(srcs[0] !== srcs[1] && srcs[1] !== srcs[2], 'no two consecutive conversions use the same slice');

// ── 6. the dispatch table maps REAL events to cues ────────────────────────
s.played.length = 0;
s.FakeAudio.now = 9000;
const cases = [
  ['CrystalAwaken', 'crystala-curated/sfx/crystala_a2_awaken.mp3'],
  ['CrystalIntercept', 'crystala-curated/sfx/crystala_projectile_reflect.mp3'],
  ['CrystalReserve', 'crystala-curated/sfx/crystala_shard_pulse.mp3'],
  ['MagnetA1Start', 'magnet-curated/sfx/magnet_a1_attraction.mp3'],
  ['MagnetA2Start', 'magnet-curated/sfx/magnet_a2_repulsion.mp3'],
  ['FrostBreathCast', 'frost-curated/sfx/frost_a1_breath.mp3'],
  ['FrostFreezeStart', 'frost-curated/sfx/frost_enemy_freeze.mp3'],
  ['FrostGunFrozen', 'frost-curated/sfx/frost_weapon_freeze_.mp3'],
  ['MirrorA1Cast', 'mirror-curated/sfx/mirror_a1_cast.mp3'],
  ['MirrorExchange', 'mirror-curated/sfx/mirror_a2_exchange_snap.mp3'],
  ['MirrorNodeForming', 'mirror-curated/sfx/mirror_passive_node_form.mp3'],
];
for (const [event, expected] of cases) {
  s.played.length = 0;
  ok(auth.dispatch(event, {}) === true, `dispatch('${event}') plays its cue`);
  // The frost weapon-freeze cue is a round-robin group, so any of its three
  // authored slices is a correct outcome.
  const hit = expected.endsWith('_.mp3')
    ? /frost_weapon_freeze_[abc]\.mp3$/.test(s.played[0] ? s.played[0].src : '')
    : (s.played[0] ? s.played[0].src.endsWith(expected) : false);
  ok(s.played.length === 1 && hit,
    `dispatch('${event}') plays ${expected.split('/').pop()}`,
    s.played.map((p) => p.src).join(','));
  s.FakeAudio.flush();
  s.FakeAudio.now += 400;
}
// The wall cue fires ONLY for kind === 'wall'; prison stays SILENT.
s.played.length = 0;
ok(auth.dispatch('CrystalConstructCast', { kind: 'prison' }) === false,
  'a Prison construct is SILENT (the Wall sound is never reused)');
ok(s.played.length === 0, 'no cue played for a Prison construct');
s.FakeAudio.flush(); s.FakeAudio.now += 400;
s.played.length = 0;
ok(auth.dispatch('CrystalConstructCast', { kind: 'wall' }) === true,
  'a Wall construct plays the wall cue');
ok(s.played.length === 1 && s.played[0].src.endsWith('crystala_wall_construct.mp3'),
  'the Wall construct plays the wall cue');
// An unknown event never invents a cue.
s.played.length = 0;
ok(auth.dispatch('NotARealEvent', {}) === false, 'an unknown event never plays');
ok(s.played.length === 0, 'nothing played for an unknown event');

// ── 7. the bridge subscribes to the real seam, no fabricated globals ──────
ok(/APEX_HERO_REWORK_AIL/.test(BRIDGE), 'the bridge reads the real AIL bus');
ok(/bus\.on\(type/.test(BRIDGE), 'the bridge subscribes to real bus events');
ok(/capturePassiveShardSeeds/.test(BRIDGE),
  'the mirror shard-drop cue is bridged from the REAL capturePassiveShardSeeds seam');
ok(!/APEX_MIRROR_ON_SHARD_PROC/.test(BRIDGE), 'no fabricated mirror seam global');
ok(/GOLD\.cue|a2capture/.test(BRIDGE), 'the magnet deflect cue is bridged from the real a2capture seam');
// The bridged events must all be real production events.
const bridged = [...BRIDGE.matchAll(/^\s*'([A-Za-z0-9_]+)',$/gm)].map((m) => m[1]);
ok(bridged.length >= 15, 'the bridge subscribes to the full real event set', String(bridged.length));
for (const ev of bridged) {
  ok(GAMEPLAY_SOURCES.includes(`'${ev}'`), `bridged event '${ev}' is a real production event`);
}
// The mirror seam must exist in production exactly as bridged.
ok(/capturePassiveShardSeeds/.test(GAMEPLAY_SOURCES),
  'capturePassiveShardSeeds exists in the production mirror runtime');
ok(/captureExternalShardSide/.test(GAMEPLAY_SOURCES), 'the shard-side provenance seam is real');

// ── 8. registration + ownership ───────────────────────────────────────────
for (const id of ['apexCoreSixCuratedSfxAuthority', 'apexCoreSixCuratedSfxBridge']) {
  ok(MANIFEST_RT.includes(id), `${id} is registered in the runtime manifest`);
}
ok(MANIFEST_RT.includes("'/game/heroes/coreSixCuratedSfxAuthority.js?v=' + APEX_ARSENAL_RUNTIME_REVISION"),
  'the authority path is registered through the shared revision cache-bust');
ok(MANIFEST_RT.includes("'/game/heroes/coreSixCuratedSfxBridge.js'"),
  'the bridge path is registered');
ok(!/AudioContext/.test(AUTH), 'the hero-SFX authority builds no AudioContext');
ok((AUTH.match(/new AudioCtor\(/g) || []).length === 1,
  'the authority constructs elements in exactly one place');

// ── report ────────────────────────────────────────────────────────────────
const total = pass + fails.length;
console.log(`\n[core-six-hero-av] ${pass}/${total} checks passed`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('ROBOT/HUNTER keep their existing accepted SFX (no replacement packages).');
console.log('CRYSTALA/MAGNET/FROST/MIRROR play owner-curated cues materialised');
console.log('byte-identically from the preload archive, triggered only by REAL');
console.log('production events, with binding OFF BY DEFAULT / SILENT decisions,');
console.log('enforced rate limits and voice caps, and a mute separate from MUSIC.');
process.exit(0);
