// ---------------------------------------------------------------------------
// Side-aware ability routing gate (owner law: input side authority).
//
// ONE truth: a cast belongs to the fighter that executes it. A key/pointer
// handler may describe WHAT triggered the cast (source/key/pointerId) but it
// may never re-own the side. Before this law a key handler that hardcoded
// {side:'p1'} made a P2 cast light up the P1 panel and emit P1Press — the
// "J/K triggers both sides" owner report.
//
// The gate executes the REAL normalizeCastInput helper from the shipping
// runtime (never a reimplementation) and asserts the routing law on the real
// key handlers.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import vm from 'node:vm';

const hr = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');
const bridge = fs.readFileSync('public/game/gold/goldProductBridge.js', 'utf8');
const failures = [];
const notes = [];
function check(name, cond, detail) {
  (cond ? notes : failures).push((cond ? 'PASS ' : 'FAIL ') + name + (detail && !cond ? ' :: ' + detail : ''));
}

// ── 1. the helper itself: the fighter owns the side ───────────────────────
const start = hr.indexOf('function normalizeCastInput(ct, source) {');
check('shipping runtime still exports normalizeCastInput', start >= 0);
if (start >= 0) {
  const end = hr.indexOf('\n  }', start) + 4;
  const source = hr.slice(start, end);
  const ctx = vm.createContext({ String, Number, Object });
  const fn = vm.runInContext(`(${source})`, ctx, { filename: 'normalizeCastInput.js' });

  const p2HitByP1Key = fn({ side: 'p2', combatantId: 'p2', idx: 1 }, { side: 'p1', source: 'keyboard', key: 'KeyJ' });
  check('a P2 fighter cast from a P1 key stays P2 (side authority beats the caller literal)',
    p2HitByP1Key.side === 'p2' && p2HitByP1Key.combatantId === 'p2',
    JSON.stringify(p2HitByP1Key));
  check('the caller-declared side is still recorded for telemetry',
    p2HitByP1Key.declaredSide === 'p1', JSON.stringify(p2HitByP1Key));
  const idxOnly = fn({ idx: 1 }, { side: 'p1', source: 'keyboard' });
  check('a combatant without an explicit side falls back to its own idx', idxOnly.side === 'p2', JSON.stringify(idxOnly));
  const p1 = fn({ side: 'p1', combatantId: 'p1', idx: 0 }, { source: 'keyboard', key: 'KeyJ' });
  check('P1 keyboard input stays P1', p1.side === 'p1' && p1.source === 'keyboard' && p1.key === 'KeyJ', JSON.stringify(p1));
  const pointer = fn({ side: 'p2', combatantId: 'p2', idx: 1 }, { side: 'p1', source: 'pointer', pointerId: 7 });
  check('pointer casts keep their pointerId on the OWNER side',
    pointer.side === 'p2' && pointer.pointerId === 7, JSON.stringify(pointer));
}

// ── 2. the real key handlers derive the side, never a literal ─────────────
check('one side resolver exists (fighter slot in the live fighters array)',
  /const sideOfFighter = \(f\) => \{[\s\S]{0,220}list\.indexOf\(f\)/.test(hr));
check('J uses the resolver', hr.includes("HR.pressAbility(f, 'A1', { side: sideOfFighter(f), source: 'keyboard', key: 'KeyJ' })"));
check('K uses the resolver', hr.includes("HR.pressAbility(f, 'A2', { side: sideOfFighter(f), source: 'keyboard', key: 'KeyK' })"));
check('Local Digit1/Digit2 use the resolver', hr.includes("HR.pressAbility(f, slot, { side: sideOfFighter(f), source: 'keyboard', key: e.code })"));
check('no key handler re-owns the side with a literal',
  !/\{ side: 'p1', source: 'keyboard'/.test(hr) && !/\{ side: 'p2', source: 'keyboard'/.test(hr));
check('the resolver reads the live fighters array (production truth)',
  /const list = globalScope\.fighters;/.test(hr) && /if \(idx === 0\) return 'p1';/.test(hr) && /if \(idx === 1\) return 'p2';/.test(hr));

// ── 3. one downstream side authority (the bus + bridge) ───────────────────
check('combatant has side identity', hr.includes("side: idx === 0 ? 'p1' : 'p2'"));
check('combatant has stable combatantId', hr.includes("combatantId: idx === 0 ? 'p1' : 'p2'"));
check('Cast carries the owner side', /AIL\.bus\.emit\('Cast',[^\n]+side: input\.side/.test(hr));
check('Cast carries combatantId', /AIL\.bus\.emit\('Cast',[^\n]+combatantId: input\.combatantId/.test(hr));
check('P1Press/P2Press derive from the owner side',
  hr.includes("if (input.side === 'p1') AIL.bus.emit('P1Press', press);") &&
  hr.includes("else AIL.bus.emit('P2Press', press);"));
check('P2 AI supplies the P2 side explicitly', hr.includes("{ side: 'p2', source: 'ai' }"));
check('local P2 keys stay LOCAL-only (BOT keeps the real CPU)',
  /AQS\.state\.battleMode !== 'LOCAL'/.test(hr));
// OWNER CORRECTION (2026-10-07): the accepted physical pair is the RIGHT-HAND
// numpad (e.code), so the top-row Digit1/Digit2 pair must never be mapped, and
// the tile/control COPY must name the pair it means instead of a bare "1".
check('the Local P2 map is the right-hand numpad pair only',
  /const LOCAL_P2_ABILITY_KEYS = \{ Numpad1: 'A1', Numpad2: 'A2' \};/.test(hr)
  && !/Digit1: 'A1'/.test(hr) && !/Digit2: 'A2'/.test(hr));
check('the Local P2 badge names the numpad pair (never a bare 1/2)',
  /return battleMode === 'BOT' \? \['CPU', 'CPU'\] : \['NUM1', 'NUM2'\];/.test(bridge));
check('generic AbilityPress exists', hr.includes("AIL.bus.emit('AbilityPress', press)"));
check('Gold cast routing prefers payload side', bridge.includes("payload.side === 'p2'") && bridge.includes("payload.side === 'p1'"));
check('hero match is fallback only', bridge.includes('Backward compatibility for old recorded events only'));
check('same-hero first-match loop is no longer primary', !bridge.includes("if (!f || heroIdOf(f) !== hero) continue;"));

// ── 4. the caster identity travels with every body-scoped event ────────────
// Owner report: "J/K triggered both sides" (input) and — same shape — in a
// ROBOT vs ROBOT match BOTH robots animated while only one had cast. The input
// side is the first half; the second half is that a body-scoped presentation cue
// must NAME its body. These checks bind that law in the shipping sources.
const robot = fs.readFileSync('public/game/hero-rework/robotPresentationRuntime.js', 'utf8');
const mechanics = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');

check('one body resolver exists (fighters[] slot is the arena body)',
  hr.includes('function bodyOfCombatant(ct) {') && hr.includes('HR.bodyOfCombatant = bodyOfCombatant;'));
check('executor contexts receive a caster-bound api',
  hr.includes('function castBoundApi(ct) {') && hr.includes('api: castBoundApi(ct),'));
check('the bound api stamps fighterId/combatantId/side/heroId on emitted events',
  /emitEvent: \{\s*\n\s*value: \(type, payload\) => base\.emitEvent\(type, Object\.assign\(\{\}, payload, identity\)\),/.test(hr));
check('the shared api was never handed to a mechanic context again', !/api: M \? M\.api : null,/.test(hr));
check('Cast lifecycle events carry the caster body id',
  (hr.match(/fighterId: bodyOfCombatant\(ct\)\?\.id \?\? null/g) || []).length >= 3);
check('mechanics emit body-scoped robot cues through the bound api',
  (mechanics.match(/ctx\.api\.emitEvent\('Robot/g) || []).length >= 8
  && !/AIL\.bus\.emit\('Robot/.test(mechanics));
check('the presentation resolves one body per event',
  robot.includes('function eventBody(payload) {') && /if \(f !== eventBody\(payload\)\) continue;/.test(robot));
check('no optional identity guard survives (the both-sides bug)',
  !robot.includes('payload.fighterId &&') && !robot.includes('payload.bodyId &&'));
check('every body-scoped robot branch is bound to that body',
  (robot.match(/if \(f !== eventBody\(payload\)\) continue;/g) || []).length >= 8);
check('the body-scoped branches also fail closed for a robot check',
  (robot.match(/if \(f !== eventBody\(payload\)\) continue;\s*\n\s*if \(!isRobotFighter\(f\)\) continue;/g) || []).length >= 8);

console.log(['SIDE-AWARE ABILITY ROUTING GATE (owner law: fighter owns the side)', ...notes].join('\n'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS (' + notes.length + ' checks)');
