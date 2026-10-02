#!/usr/bin/env node
/* CHECKPOINT H-PHYS — source + structural gates.
 *
 * The live behaviour is proven by
 * tools/testHunterPouncePhysicalContactRealBrowser.mjs. This file locks the
 * STRUCTURE so the defect cannot silently return:
 *   - Hunter may not self-certify contact inside its executor;
 *   - the success bundle exists exactly once, in one atomic transaction;
 *   - contact is adjudicated after movement, against real frame paths;
 *   - no hero-specific "if Magnet A2 active then ignore" immunity exists;
 *   - no other explicit body mover self-certifies a contact outcome.
 */
import fs from 'node:fs';

const mech = fs.readFileSync('public/game/hero-rework/heroMechanicsRuntime.js', 'utf8');
const world = fs.readFileSync('public/game/hero-rework/heroReworkRuntime.js', 'utf8');
const magnetSrcW3 = fs.readFileSync('public/game/hero-rework/magnetGameplayRuntime.js', 'utf8');

const report = { gates: {}, failures: [] };
function gate(name, ok, detail) {
  report.gates[name] = { pass: !!ok, detail };
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

/* ---- the deferred seam exists and is used ---- */
gate('S01-defer-seam-exists',
  /deferBodyContact\s*\(req\)\s*\{/.test(world) && /pendingBodyContacts/.test(world));
gate('S02-resolver-runs-after-movement',
  /function resolvePendingBodyContacts\(\)/.test(world)
  && /resolvePendingBodyContacts\(\);[\s\S]{0,200}?tickWorld\(dt\);/.test(world)
  && world.indexOf('resolvePendingBodyContacts();') < world.indexOf('resolvePendingMirrorSnaps();'),
  'resolver must run in hrPostTick, i.e. after Fighter.update');
gate('S03-frame-start-samples-recorded',
  /__hrFrameStart/.test(world) && /b\.__hrFrameStart\.x = b\.x; b\.__hrFrameStart\.y = b\.y;/.test(world));
// W3/W4: upgraded from a single frame-start -> frame-end relative chord to a
// piecewise sweep over the ORDERED body paths both bodies actually travelled,
// so a Magnet-curved path can neither fake a catch nor hide a real one.
gate('S04-resolver-uses-both-real-ordered-paths',
  /function bodyPathSegments\(b\)/.test(world)
  && /function samplePath\(segs, n\)/.test(world)
  && /const moverPts = samplePath\(bodyPathSegments\(mover\), CONTACT_SAMPLES\)/.test(world)
  && /const tgtPts = samplePath\(bodyPathSegments\(tgt\), CONTACT_SAMPLES\)/.test(world)
  && /segmentToPointToi\(ax, ay, bx, by, 0, 0, R\)/.test(world),
  'piecewise relative sweep over both real ordered paths');
gate('S05-body-field-subsegments-recorded',
  /function bodyFieldPath\(body\)/.test(magnetSrcW3)
  && /path\.push\(\{ x0: sx, y0: sy, x1: bx, y1: byp/.test(magnetSrcW3)
  && /stage: 'field'/.test(world) && /stage: 'explicit'/.test(world)
  && /stage: 'canonical'/.test(world),
  'ordered body path keeps explicit / field / canonical stages distinct');
gate('S06-owner-rating-not-reused-as-speed-cap',
  !/A2_RADIAL_STOP_RATING \/ sp/.test(magnetSrcW3)
  && /A2_FIELD_MAX_WORK_SPEED/.test(magnetSrcW3)
  && /A2_RADIAL_STOP_RATING: 3500/.test(magnetSrcW3),
  'the 3500 rating is a field power anchor, not a velocity ceiling');

/* ---- Hunter no longer self-certifies ---- */
const a2Block = (() => {
  const i = mech.indexOf("EXECUTORS['hunter.pounce_weak']");
  return i < 0 ? '' : mech.slice(i, mech.indexOf('onTeardown', i));
})();
gate('S10-hunter-a2-block-isolated', a2Block.length > 200);
gate('S11-hunter-a2-defers-contact', /ctx\.api\.deferBodyContact\(\{/.test(a2Block));
gate('S12-hunter-a2-does-not-adjudicate-inline',
  !/sweptHunterContact/.test(a2Block),
  'the executor must not run its own contact sweep');
gate('S13-hunter-a2-commits-nothing-inline',
  !/applyStunTo/.test(a2Block) && !/applyWeakCombatant/.test(a2Block)
  && !/PounceWeak/.test(a2Block) && !/hunter-a2-disarm/.test(a2Block));

/* ---- one atomic success transaction ---- */
gate('S20-single-commit-function',
  (mech.match(/function commitHunterPounceCatch\(/g) || []).length === 1);
gate('S21-commit-is-the-only-site-of-each-consequence',
  (mech.match(/applyStunTo\(hit/g) || []).length === 1
  && (mech.match(/'PounceWeak'/g) || []).length === 1
  && (mech.match(/'hunter-a2-disarm'/g) || []).length === 1
  && (mech.match(/'HunterA2Disarm'/g) || []).length === 1
  && (mech.match(/APEX_HUNTER_PRESENTATION\.catch\(/g) || []).length === 1,
  {
    stun: (mech.match(/applyStunTo\(hit/g) || []).length,
    pounceWeak: (mech.match(/'PounceWeak'/g) || []).length,
    disarm: (mech.match(/'hunter-a2-disarm'/g) || []).length,
    disarmEvent: (mech.match(/'HunterA2Disarm'/g) || []).length,
    catchPresentation: (mech.match(/APEX_HUNTER_PRESENTATION\.catch\(/g) || []).length,
  });
gate('S22-commit-only-reached-from-resolver',
  (mech.match(/commitHunterPounceCatch\(/g) || []).length === 2,
  'exactly one definition + one call from the deferred onContact');

/* ---- no fake immunity anywhere ---- */
const immunity = /(a2Active|magnetA2|A2_RADIUS)[^\n]{0,80}(return|skip|ignore)[^\n]{0,40}(stun|STUN|cc|CC)/i;
gate('S30-no-magnet-cc-immunity-special-case',
  !immunity.test(mech) && !immunity.test(world)
  && !/MAGNET[^\n]{0,40}(immune|immunity)/i.test(mech)
  && !/MAGNET[^\n]{0,40}(immune|immunity)/i.test(world));

/* ---- Magnet protected values untouched ---- */
const magnet = fs.readFileSync('public/game/hero-rework/magnetGameplayRuntime.js', 'utf8');
const reg = fs.readFileSync('public/game/hero-rework/heroRegistry.js', 'utf8');
// H-PHYS2 §28 SUPERSEDED ASSERTION. This previously required the linear
// `fall = 1 - d/radius` radial-SPEED-target body law and the 650 cap. H-PHYS2
// §1/§6/§7 replace that with ONE continuous nonlinear field shared by bullets,
// bodies and floor firearms, so asserting the old shape would now forbid the
// owner-directed law. The protection is retargeted, not dropped: the field
// radius is still 225, the body must consume the SAME S(d) as everything else,
// and the coupling must come from the single rating.
gate('S31-magnet-body-consumes-the-one-shared-field',
  /radius: 225/.test(reg)
  && /function fieldStrength\(d, radius\)/.test(magnet)
  && /A2_RADIAL_STOP_RATING: 3500/.test(magnet)
  && /A2_FIELD_COUPLING/.test(magnet)
  && /fieldCoupling\(rt\.fieldRef\) \* fieldStrength\(dd, rt\.radius\)/.test(magnet)
  && !/const fall = clamp\(1 - d \/ radius, 0, 1\)/.test(magnet),
  'body must use the shared S(d), not the superseded linear target');

/* ---- Hunter protected numbers unchanged ---- */
gate('S32-hunter-a2-protected-config',
  /cooldown: 12, windup: 0\.16, moveSpeed: 2200, maxMoveTime: 0\.50/.test(reg)
  && /directDamage: 0, stunDuration: 2\.0, weakDuration: 1\.0/.test(reg));

/* ---- moveHunterBody remains the solid-world authority ---- */
gate('S33-movehunterbody-still-wall-authority',
  /moveHunterBody\(body, x, y\)/.test(world) && /if\(wallsBlockPoint\(nx,ny,r\)\) break;/.test(world));

/* ---- H-PHYS.8 structural audit of other explicit body movers ----
 * The defect is "explicit mover commits a contact outcome from its own
 * pre-physics motion". A mover that only moves is not affected, because its
 * position still passes through Magnet body force and canonical walls before
 * anything resolves against it. */
const robotBlock = (() => {
  const i = mech.indexOf("EXECUTORS['robot.weapon_dash']");
  return i < 0 ? '' : mech.slice(i, mech.indexOf('EXECUTORS[', i + 10));
})();
// Strip comments first: the dash body deliberately CONTAINS the words
// "Do NOT emit RobotA1Contact here", which is prose, not an emission.
const stripComments = (t) => t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const robotTick = stripComments(robotBlock.slice(0, robotBlock.indexOf('onEquipOffensive')));
gate('S40-robot-a1-dash-does-not-self-certify-contact',
  robotBlock.length > 200
  && /a\.x \+= Math\.cos\(d\.heading\)/.test(robotBlock)          // it IS an explicit mover
  && robotBlock.indexOf('onEquipOffensive') > 0
  && !/emitEvent\(\s*'RobotA1Contact'/.test(robotTick),
  'Robot A1 moves explicitly but its contact authority is the real equip resolution');
gate('S41-only-expected-explicit-movers-mutate-position',
  (mech.match(/^\s*a\.x\s*(\+=|=)/gm) || []).length <= 2,
  { sites: (mech.match(/^\s*a\.x\s*(\+=|=)/gm) || []).length });

const total = Object.keys(report.gates).length;
fs.mkdirSync('docs/hero-rework/evidence', { recursive: true });
fs.writeFileSync('docs/hero-rework/evidence/hunter-pounce-structural-gates.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  law: 'Hunter A2 may propose pursuit movement but may not certify its own contact. Control effects require resolved physical contact.',
  explicitMoverAudit: {
    'hunter.pounce_weak': 'FIXED — proposes movement, defers contact to the post-movement resolver',
    'hunter.snare (A1 recoil)': 'SAFE — moves via moveHunterBody (wall authority), adjudicates no contact',
    'robot.weapon_dash': 'SAFE — explicit mover, but contact authority is the real equip resolution (onEquipOffensive) which runs on the post-movement position; the dash never emits RobotA1Contact itself',
    'sniper A2 position lock': 'NOT CONTACT-SENSITIVE — lock only, no body translation',
    'frost movement lock': 'NOT CONTACT-SENSITIVE — lock only',
    'slime promoted/child bodies': 'SAFE — driven through the full canonical engine pipeline (child.update)',
  },
  ...report, pass: report.failures.length === 0,
}, null, 2));

console.log(`\n[HUNTER POUNCE PHYSICAL CONTACT — STRUCTURAL] ${total - report.failures.length}/${total} gates passed`);
if (report.failures.length) console.log(`FAILURES: ${report.failures.join(', ')}`);
process.exit(report.failures.length ? 1 : 0);
