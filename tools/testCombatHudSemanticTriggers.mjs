// Battle HUD SEMANTIC TRIGGER AUTHORITY — deterministic proof.
//
// Owner patch (2026-10-04) requires deterministic tests for
// Normal / Critical / Heavy / Thunder / Heal, plus the five Heavy burst cases
// and proof that DOM-to-DOM inference and demo keyboard bindings are not
// trigger authority.
//
// Deterministic and browser-independent:
//   node tools/testCombatHudSemanticTriggers.mjs
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

// ── Load the real shipping runtime (not a re-implementation) ─────────────────
const RUNTIME = 'public/game/ui/apexCombatHudTriggerRuntime.js';
const source = fs.readFileSync(RUNTIME, 'utf8');

// A faithful Arsenal identity stub. The classifier must ask Arsenal whether a
// weapon is a gun; it must never own the list itself.
const GUN_IDS = ['PISTOL', 'SMG', 'SHOTGUN', 'SNIPER', 'RIFLE'];
function makeContext(nowRef) {
  const context = {
    APEX_ARSENAL_CONFIG: {
      GUN_REGISTRY: GUN_IDS.map((id) => ({ id })),
      isGun: (id) => GUN_IDS.includes(id),
      isMelee: (id) => ['SABRE', 'BATTLE_AXE', 'DAGGER'].includes(id),
    },
    performance: { now: () => nowRef.t },
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: RUNTIME });
  return context;
}

function makeSession(startAt = 1000) {
  const nowRef = { t: startAt };
  const ctx = makeContext(nowRef);
  const T = ctx.APEX_COMBAT_HUD_TRIGGERS;
  const session = T.createSession({ now: () => nowRef.t });
  return { T, session, nowRef, advance: (ms) => { nowRef.t += ms; } };
}

const victim = (id) => ({ id, name: `V${id}`, hp: 1000, maxHp: 1000 });
const kinds = (session) => session.drain().map((t) => t.kind);

// The runtime executes inside a vm context, so the arrays it returns carry that
// realm's Array prototype. node:assert/strict deepEqual is prototype-sensitive,
// so every sequence comparison is normalized into a host array first.
const seq = (value) => Array.from(value ?? []);
function eqSeq(actual, expected, message) {
  assert.deepEqual(seq(actual), expected, message);
}

// ── 1. NORMAL HIT ────────────────────────────────────────────────────────────
gate('normal-hit-from-real-realized-damage', () => {
  const { T, session } = makeSession();
  const res = session.onRealizedDamage({
    attacker: victim(1), victim: victim(2), amount: 42, critical: false,
    label: 'arsenal-pistol', statusDamage: false,
  });
  assert.equal(res.critical, false);
  eqSeq(res.kinds, [T.KIND.NORMAL_HIT]);
  const triggers = session.drain();
  eqSeq(triggers.map((t) => t.kind), [T.KIND.NORMAL_HIT]);
  assert.equal(triggers[0].semantic.tone, 'red');
  assert.equal(triggers[0].semantic.treatment, 'standard');
  return 'non-crit realized damage -> NORMAL_HIT (red)';
});

gate('normal-hit-not-from-dom-node', () => {
  // The runtime must not accept a DOM damage-number node as damage truth.
  const { T, session } = makeSession();
  const res = session.onRealizedDamage({
    victim: { id: 2, textContent: '-999' }, amount: 0, label: 'arsenal-pistol',
  });
  assert.equal(res, null);
  eqSeq(session.drain(), []);
  assert.equal(session.stats.rejectedNonPositive, 1);
  assert.ok(!/\bdocument\b/.test(source), 'trigger runtime must not touch the DOM');
  return 'zero/absent realized amount presents nothing; runtime has no DOM access';
});

// ── 2. CRITICAL (firearm only) ───────────────────────────────────────────────
gate('critical-from-confirmed-firearm-crit', () => {
  const { T, session } = makeSession();
  const res = session.onRealizedDamage({
    attacker: victim(1), victim: victim(2), amount: 88, critical: true,
    label: 'arsenal-pistol', statusDamage: false,
  });
  assert.equal(res.critical, true);
  eqSeq(res.kinds, [T.KIND.CRITICAL]);
  const [t] = session.drain();
  assert.equal(t.kind, T.KIND.CRITICAL);
  assert.equal(t.semantic.tone, 'orange');
  assert.equal(t.semantic.treatment, 'diamond');
  return 'firearm crit -> CRITICAL (orange/diamond)';
});

// Each of these is explicitly forbidden by the owner patch from being Critical
// "merely because damage is large".
const FORBIDDEN_CRIT = [
  ['melee', { amount: 900, critical: true, label: 'arsenal-sabre' }],
  ['grenade', { amount: 900, critical: true, label: 'arsenal-grenade' }],
  ['shield-damage', { amount: 900, critical: true, label: 'arsenal-tower_shield' }],
  ['stormbreaker', { amount: 446, critical: true, label: 'arsenal-stormbreaker' }],
  ['native-hero-skill', { amount: 900, critical: true, label: 'mirror-shard' }],
  ['environmental', { amount: 900, critical: true, label: 'clock-hand' }],
  ['status-dot', { amount: 900, critical: true, label: 'arsenal-pistol', statusDamage: true }],
];
for (const [name, ev] of FORBIDDEN_CRIT) {
  gate(`large-${name}-damage-is-never-critical`, () => {
    const { T, session } = makeSession();
    const res = session.onRealizedDamage({ attacker: victim(1), victim: victim(2), ...ev });
    assert.equal(res.critical, false, `${name} must not classify as Critical`);
    assert.ok(!res.kinds.includes(T.KIND.CRITICAL), `${name} emitted CRITICAL`);
    assert.ok(res.kinds.includes(T.KIND.NORMAL_HIT) || res.kinds.includes(T.KIND.HEAVY)
      || res.kinds.includes(T.KIND.THUNDER), `${name} produced no classification`);
    return `${name} (amount=${ev.amount}) -> not CRITICAL`;
  });
}

gate('critical-guard-fails-closed-without-arsenal-identity', () => {
  const nowRef = { t: 1000 };
  const context = { performance: { now: () => nowRef.t }, Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON };
  context.window = context; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: RUNTIME });
  const session = context.APEX_COMBAT_HUD_TRIGGERS.createSession({ now: () => nowRef.t });
  const res = session.onRealizedDamage({ victim: victim(2), amount: 90, critical: true, label: 'arsenal-pistol' });
  assert.equal(res.critical, false, 'without Arsenal isGun the firearm origin is unconfirmed');
  assert.equal(session.stats.rejectedUnconfirmedFirearm, 1);
  return 'missing Arsenal identity -> not Critical (fail-closed)';
});

// ── 3. HEAVY — the five owner-mandated burst cases ──────────────────────────
gate('heavy-one-single-hit-over-200', () => {
  const { T, session } = makeSession();
  const res = session.onRealizedDamage({ victim: victim(2), amount: 260, label: 'arsenal-shotgun' });
  assert.equal(res.heavy, true);
  assert.ok(res.kinds.includes(T.KIND.HEAVY));
  const heavy = session.drain().filter((t) => t.kind === T.KIND.HEAVY);
  assert.equal(heavy.length, 1);
  assert.equal(heavy[0].burstTotal, 260);
  assert.equal(heavy[0].threshold, 200);
  assert.equal(heavy[0].windowMs, 1200);
  return 'single 260 hit -> one HEAVY';
});

gate('heavy-exactly-200-does-not-qualify', () => {
  const { T, session } = makeSession();
  // "MORE THAN 200" — 200 itself must not qualify.
  const res = session.onRealizedDamage({ victim: victim(2), amount: 200, label: 'arsenal-shotgun' });
  assert.equal(res.heavy, false);
  assert.ok(!res.kinds.includes(T.KIND.HEAVY));
  return 'exactly 200 -> no HEAVY (strictly greater required)';
});

gate('heavy-smaller-hits-crossing-200-inside-1-20s', () => {
  const { T, session, advance } = makeSession();
  const v = victim(2);
  let heavy = null;
  for (const [dt, amount] of [[0, 60], [200, 70], [400, 50], [300, 40]]) {
    advance(dt);
    const res = session.onRealizedDamage({ victim: v, amount, label: 'arsenal-smg' });
    if (res.heavy) heavy = res;
  }
  assert.ok(heavy, 'burst crossing 200 inside the window must trigger HEAVY');
  const triggers = session.drain().filter((t) => t.kind === T.KIND.HEAVY);
  assert.equal(triggers.length, 1, 'exactly one HEAVY for the crossing burst');
  assert.equal(triggers[0].burstTotal, 220, '200 crossed on the 4th hit (60+70+50+40)');
  assert.equal(triggers[0].burstHits, 4);
  return '60+70+50+40 across 900ms -> one HEAVY at 220';
});

gate('heavy-hits-outside-rolling-window-do-not-accumulate', () => {
  const { T, session, advance } = makeSession();
  const v = victim(2);
  const results = [];
  // Each hit is >1.20 s after the previous one, so no rolling burst ever
  // accumulates past 200.
  for (const amount of [120, 120, 120, 120]) {
    advance(1500);
    results.push(session.onRealizedDamage({ victim: v, amount, label: 'arsenal-smg' }));
  }
  assert.ok(results.every((r) => !r.heavy), 'spaced hits must not form a burst');
  eqSeq(session.drain().filter((t) => t.kind === T.KIND.HEAVY), []);
  return '4x120 spaced 1.50s apart -> zero HEAVY';
});

gate('heavy-window-boundary-is-exclusive-at-1-20s', () => {
  const { T, session, advance } = makeSession();
  const v = victim(2);
  session.onRealizedDamage({ victim: v, amount: 150, label: 'arsenal-smg' });
  // Exactly 1200 ms later the first hit has left the rolling window.
  advance(1200);
  const res = session.onRealizedDamage({ victim: v, amount: 150, label: 'arsenal-smg' });
  assert.equal(res.heavy, false, 'a hit exactly at the window edge is outside it');
  const snap = session.burstSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].total, 150);
  assert.equal(snap[0].hits, 1);
  // 1 ms inside the window they DO accumulate.
  session.reset();
  session.onRealizedDamage({ victim: v, amount: 150, label: 'arsenal-smg' });
  advance(1199);
  const inside = session.onRealizedDamage({ victim: v, amount: 150, label: 'arsenal-smg' });
  assert.equal(inside.heavy, true, 'hits inside the window accumulate');
  return 'boundary: +1200ms drops the hit, +1199ms keeps it';
});

gate('heavy-no-replay-for-later-hits-in-same-burst', () => {
  const { T, session, advance } = makeSession();
  const v = victim(2);
  session.onRealizedDamage({ victim: v, amount: 260, label: 'arsenal-shotgun' });
  // Continued damage inside the same qualifying burst must not replay HEAVY.
  for (let i = 0; i < 6; i++) {
    advance(100);
    session.onRealizedDamage({ victim: v, amount: 90, label: 'arsenal-shotgun' });
  }
  const heavies = session.drain().filter((t) => t.kind === T.KIND.HEAVY);
  assert.equal(heavies.length, 1, 'HEAVY fires at most once per qualifying burst');
  assert.equal(session.stats.rejectedHeavyReplay, 6, 'each later hit was explicitly rejected as a replay');
  return '1 qualifying hit + 6 follow-ups -> still one HEAVY';
});

gate('heavy-latch-resets-when-rolling-burst-ends', () => {
  const { T, session, advance } = makeSession();
  const v = victim(2);
  session.onRealizedDamage({ victim: v, amount: 260, label: 'arsenal-shotgun' });
  assert.equal(session.burstSnapshot()[0].triggered, true);
  // Let the rolling window empty: the burst ends and the latch resets.
  advance(1300);
  const res = session.onRealizedDamage({ victim: v, amount: 260, label: 'arsenal-shotgun' });
  assert.equal(res.heavy, true, 'a NEW burst after the window emptied may trigger HEAVY again');
  assert.equal(session.drain().filter((t) => t.kind === T.KIND.HEAVY).length, 2);
  return 'burst latch resets naturally after a 1.30s gap';
});

gate('heavy-independent-victims-are-tracked-separately', () => {
  const { T, session, advance } = makeSession();
  const a = victim(2);
  const b = victim(3);
  session.onRealizedDamage({ victim: a, amount: 120, label: 'arsenal-smg' });
  advance(100);
  // Same window, but the second victim has only taken 120 — no Heavy yet.
  const rb = session.onRealizedDamage({ victim: b, amount: 120, label: 'arsenal-smg' });
  assert.equal(rb.heavy, false, 'victim B has not crossed 200');
  assert.equal(session.burstSnapshot().length, 2, 'two independent rolling windows');
  advance(100);
  const ra = session.onRealizedDamage({ victim: a, amount: 120, label: 'arsenal-smg' });
  assert.equal(ra.heavy, true, 'victim A crosses 200 on its own window');
  advance(100);
  const rb2 = session.onRealizedDamage({ victim: b, amount: 120, label: 'arsenal-smg' });
  assert.equal(rb2.heavy, true, 'victim B crosses 200 on its own window');
  assert.equal(session.drain().filter((t) => t.kind === T.KIND.HEAVY).length, 2);
  return 'two victims, two windows, two independent HEAVY triggers';
});

gate('heavy-is-presentation-only-not-a-damage-mechanic', () => {
  const { session } = makeSession();
  const ev = { victim: victim(2), amount: 260, label: 'arsenal-shotgun' };
  const snapshot = JSON.stringify({ amount: ev.amount, victimHp: ev.victim.hp });
  const res = session.onRealizedDamage(ev);
  assert.equal(res.heavy, true);
  // The classifier must not mutate the transaction it observed.
  assert.equal(JSON.stringify({ amount: ev.amount, victimHp: ev.victim.hp }), snapshot);
  assert.ok(!/CRIT_DAMAGE_MULTIPLIER|ARSENAL_DAMAGE_SCALE|takeDamage\s*\(/.test(source),
    'trigger runtime must contain no damage scaling or damage application');
  return 'HEAVY observes the transaction without mutating it or scaling damage';
});

// ── 4. THUNDER / STORMBREAKER ────────────────────────────────────────────────
gate('thunder-stormbreaker-is-heavy-plus-thunder', () => {
  const { T, session } = makeSession();
  const res = session.onRealizedDamage({
    attacker: victim(1), victim: victim(2), amount: 446, critical: false,
    label: 'arsenal-stormbreaker', statusDamage: false,
  });
  assert.equal(res.stormbreaker, true);
  assert.equal(res.critical, false, 'Stormbreaker is never reinterpreted as a crit');
  assert.ok(res.kinds.includes(T.KIND.HEAVY), 'Stormbreaker belongs to the HEAVY family');
  assert.ok(res.kinds.includes(T.KIND.THUNDER), 'Stormbreaker layers THUNDER identity');
  const k = session.drain().map((t) => t.kind);
  assert.ok(k.includes(T.KIND.NORMAL_HIT));
  assert.ok(k.includes(T.KIND.HEAVY));
  assert.ok(k.includes(T.KIND.THUNDER));
  assert.ok(!k.includes(T.KIND.CRITICAL));
  return 'Stormbreaker 446 -> NORMAL + HEAVY + THUNDER, never CRITICAL';
});

gate('thunder-does-not-replace-global-critical-semantics', () => {
  const { T, session } = makeSession();
  // A normal firearm crit immediately after a Stormbreaker event must still be
  // an ordinary CRITICAL — Thunder must not become the global crit identity.
  session.onRealizedDamage({ victim: victim(2), amount: 446, label: 'arsenal-stormbreaker' });
  session.drain();
  const res = session.onRealizedDamage({
    victim: victim(3), amount: 88, critical: true, label: 'arsenal-pistol',
  });
  assert.equal(res.critical, true);
  assert.equal(res.thunder, false);
  const k = session.drain().map((t) => t.kind);
  assert.ok(k.includes(T.KIND.CRITICAL));
  assert.ok(!k.includes(T.KIND.THUNDER));
  return 'firearm crit after Stormbreaker stays CRITICAL, no THUNDER';
});

// ── 5. HEAL ──────────────────────────────────────────────────────────────────
gate('heal-from-real-transaction', () => {
  const { T, session } = makeSession();
  const res = session.onHeal({ target: victim(2), amount: 60, overheal: false });
  assert.equal(res.kind, T.KIND.HEAL);
  assert.equal(res.semantic.tone, 'green');
  assert.equal(res.amount, 60);
  return 'real heal transaction -> HEAL (green)';
});

gate('heal-not-inferred-from-dom-or-animation', () => {
  const { session } = makeSession();
  // Green DOM text / animation state is not a heal source.
  assert.equal(session.onHeal({ target: { id: 2, textContent: '+50', style: { color: 'green' } } }), null);
  assert.equal(session.onHeal({ target: victim(2), amount: 0 }), null);
  eqSeq(session.drain(), []);
  // Both malformed heals were rejected (missing amount + zero amount).
  assert.equal(session.stats.rejectedNonPositive, 2);
  return 'no amount -> no HEAL; DOM text is not accepted';
});

// ── 6/7. WEAPON CHANGE + LOW HP ──────────────────────────────────────────────
gate('weapon-change-from-real-ownership-change', () => {
  const { T, session } = makeSession();
  const res = session.onWeaponChange({ holder: victim(1), from: 'PISTOL', to: 'SHOTGUN' });
  assert.equal(res.kind, T.KIND.WEAPON_CHANGE);
  assert.equal(res.to, 'SHOTGUN');
  // No real change must not present.
  assert.equal(session.onWeaponChange({ holder: victim(1), from: 'SHOTGUN', to: 'SHOTGUN' }), null);
  return 'real equip change presents; identical->identical does not';
});

gate('low-hp-crossing-edge-uses-production-threshold', () => {
  const { T, session } = makeSession();
  const first = session.syncLowHp([{ subject: 'p1', id: 1, hp: 180, low: true }]);
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, T.KIND.LOW_HP);
  // Staying low must not re-fire (it is a state crossing, not a per-hit event).
  eqSeq(session.syncLowHp([{ subject: 'p1', id: 1, hp: 120, low: true }]), []);
  const cleared = session.syncLowHp([{ subject: 'p1', id: 1, hp: 700, low: false }]);
  assert.equal(cleared[0].kind, T.KIND.LOW_HP_CLEARED);
  // The threshold is supplied by production; the runtime owns none.
  assert.ok(!/LOW_HP_(THRESHOLD|RATIO)\s*=/.test(source), 'runtime must not author its own HP threshold');
  return 'LOW HP fires on the crossing edge only, threshold is production-owned';
});

// ── 8/9. SKILL CAST + SKILL READY ────────────────────────────────────────────
gate('skill-cast-only-from-accepted-cast', () => {
  const { T, session } = makeSession();
  // Production emits 'Cast' only after exec.cast() returned truthy.
  const ok = session.onSkillCast({ hero: 'MIRROR', slot: 'A1', mechanic: 'mirrorA1' });
  assert.equal(ok.kind, T.KIND.SKILL_CAST);
  // A rejected/blocked cast must never fake a successful cast presentation.
  assert.equal(session.onSkillCast({ hero: 'MIRROR', slot: 'A2', reason: 'whiff' }), null);
  assert.equal(session.onSkillCast({ hero: 'MIRROR', slot: 'A2', rejected: true }), null);
  assert.equal(session.stats.skillCast, 1);
  return 'accepted cast presents; CastFailCue never does';
});

gate('skill-ready-only-from-real-cooldown-transition', () => {
  const { T, session } = makeSession();
  assert.equal(session.onSkillReady({ hero: 'FROST', slot: 'A1', usable: false }), null);
  const ready = session.onSkillReady({ hero: 'FROST', slot: 'A1', usable: true, charges: 1 });
  assert.equal(ready.kind, T.KIND.SKILL_READY);
  assert.equal(session.stats.skillReady, 1);
  return 'READY requires a real usable transition';
});

// ── 10/11. KO + MATCH STATE ──────────────────────────────────────────────────
gate('ko-only-from-real-authoritative-result', () => {
  const { T, session } = makeSession();
  const ko = session.onKO({ victim: victim(2), winner: victim(1), reason: 'KO' });
  assert.equal(ko.kind, T.KIND.KO);
  assert.equal(session.onKO({}), null);
  assert.equal(session.stats.ko, 1);
  return 'KO requires a real victim/winner result';
});

gate('match-state-only-from-real-transition', () => {
  const { T, session } = makeSession();
  const a = session.onMatchState({ state: 'ROUND_START', round: 1 });
  assert.equal(a.kind, T.KIND.MATCH_STATE);
  assert.equal(a.from, null);
  assert.equal(session.onMatchState({ state: 'ROUND_START' }), null, 'same state is not a transition');
  const b = session.onMatchState({ state: 'RESULT', result: 'P1_WIN' });
  assert.equal(b.from, 'ROUND_START');
  assert.equal(b.to, 'RESULT');
  return 'match-state presents only on a real transition';
});

// ── Session hygiene ──────────────────────────────────────────────────────────
gate('reset-clears-bursts-latches-and-backlog', () => {
  const { session } = makeSession();
  session.onRealizedDamage({ victim: victim(2), amount: 260, label: 'arsenal-shotgun' });
  session.syncLowHp([{ id: 1, subject: 'p1', low: true }]);
  assert.ok(session.pending() > 0);
  session.reset();
  assert.equal(session.pending(), 0);
  eqSeq(session.burstSnapshot(), []);
  eqSeq(session.syncLowHp([{ id: 1, subject: 'p1', low: true }]).map((t) => t.kind),
    ['LOW_HP'], 'low-HP latch must not survive into a rematch');
  return 'rematch starts with no inherited window, latch or backlog';
});

// ── INPUT / CONTROL LAW ──────────────────────────────────────────────────────
gate('input-keys-are-not-trigger-authority', () => {
  // The classifier consumes semantic events. It must contain no key handling,
  // so changing J/K or any future skill key cannot require rewriting it.
  for (const banned of ['addEventListener', 'keydown', 'onkeydown', "e.key", "'j'", "'k'", "'m'"]) {
    assert.ok(!source.includes(banned), `trigger runtime must not reference ${banned}`);
  }
  return 'no key listener, no key literal, no skill-key coupling';
});

gate('no-demo-effect-trigger-surface-in-trigger-runtime', () => {
  // Gold donor demo controls (viewport preset, sim pause, diag, lab, reset,
  // synthetic normal/crit/heavy damage, weapon swap) must not exist here.
  for (const banned of ['resetDemo', 'applyViewport', 'runDiag', 'swapWeapon(', 'PRESETS']) {
    assert.ok(!source.includes(banned), `demo donor control ${banned} leaked into production`);
  }
  return 'donor demo controls absent from production trigger authority';
});

// ── Summary ──────────────────────────────────────────────────────────────────
const passed = Object.values(report.gates).filter((g) => g.pass).length;
const total = Object.values(report.gates).length;
console.log(`\n${passed}/${total} gates passed`);
if (report.failures.length) {
  console.error('FAILED:', report.failures.join(', '));
}
process.exitCode = report.failures.length ? 1 : 0;
