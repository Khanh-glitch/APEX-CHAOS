# APEX CHAOS — ROBOT + SLIME MODEL QUALIFICATION TASK
Date: 2026-09-28

## Purpose
This is a bounded corrective pilot and model-quality test. The current Hero Rework passed automated suites but failed owner gameplay validation: all 12 Heroes were rejected. Repair only the shared locomotion law plus ROBOT and SLIME, produce real-browser behavioral proof, then stop for owner playtest. Do not repair the other 10 Hero kits.

## Authority
Failed owner-playtest baseline:
`2071dcf34acc4fed6f92fee3ea72a0e5d00fb2d7`

Safety:
`safety/hero-rework-owner-failed-20260928`

Owner-failure audit:
`docs/hero-rework/phase1/09_OWNER_PLAYTEST_FAILURE_AUDIT_2026-09-28.md`
commit `e96d9c17231dcd44e4c466b2da0a1dd4fb40351a`

Read completely before coding:
1. 00_READ_FIRST.md
2. 01_AIL_V2_CANONICAL.md
3. 02_LEVEL1_CANONICAL_BASELINE_V1_2.md
4. 03_HERO_DEFINITION_CONTRACT_V1_FINAL.md
5. 04_PHASE1_FINAL_FREEZE_AND_ROSTER_CUTOVER.md
6. 06_POSTFREEZE_ROSTER_CORRECTION.md
7. 09_OWNER_PLAYTEST_FAILURE_AUDIT_2026-09-28.md
8. this file

Audit real production code, especially:
`public/apexEngine.js`,
`public/game/hero-rework/*`,
`public/game/arsenal/arsenalShellSelectRuntime.js`,
`public/game/arsenal/arsenalWeaponRuntime.js`,
`public/game/modes/arsenalQuestRuntime.js`,
and the real browser/headless/golden/smoke harnesses.

Arena workspaces are ephemeral. Remote Git is durable. Never force-push. After every coherent fix: targeted proof -> commit -> fetch/reconcile -> push.

## Owner-observed failures
- Every Hero currently feels wrong / fails expected skill fidelity.
- ROBOT behaves as if an invisible hand steers it toward pickups/opponents instead of obeying original APEX bounce locomotion.
- SLIME hitches on large/sniper hits; split behavior is wrong; split bodies appear actively steered.

Treat these as real product failures even if tests are green.

## Hard locomotion law
Ordinary reworked Hero movement must obey original APEX locomotion:
- preserve heading / normal engine motion;
- wall/body interaction changes motion through normal physics;
- no automatic pickup seeking;
- no chase/kite steering;
- no ideal-distance controller;
- weapon aim remains independent of body heading;
- pickups happen by physical contact.

Only explicit Hero mechanics may override motion, e.g. ROBOT A1 or HUNTER A2.

Audit every path that mutates body direction/position outside base physics, statuses, and explicit mechanics. The known suspect is generic Hero shell movement / `HR.shellUpdate()`, but do not stop the audit there.

## ROBOT target
Normal state: base APEX locomotion only.

A1 Weapon Dash:
- CD 10s
- speed 3400
- max 0.55s
- turn 11 rad/s
- nearest eligible revealed pickup
- T6 not auto-targeted
- physical movement, no teleport/ownership transfer
- physical walk-over pickup remains the pickup authority
- A1 is the only ROBOT pickup-steering mechanic

A2 Virtual Armor:
- CD 10s
- 3.0s
- 55% DR / incoming x0.45
- no separate CC immunity

Passive:
- use the existing visible cumulative damage-dealt milestone ladder
- #1 no refund; #2 0.5s; #3 1.0s; #4 1.5s; later +0.5s
- one proc each; credited realized damage; refund relevant Active
- DO NOT invent threshold values

Exhaustively find the actual visible ladder source. If no authoritative thresholds exist, report the blocker honestly and do not call the Passive complete.

## SLIME target
One Combatant, multiple Bodies. Children stay outside global `fighters[]`.

Every Body:
- independent physical heading;
- normal APEX movement/bounce;
- no generic chase/kite/pickup steering;
- pickup only by contact.

A1 Mitosis:
- CD 14s, duration 6s, exactly 2 Bodies
- current HP split evenly; no duplication
- physical area conserved
- initial divergence target +/-25
- one Body keeps weapon; other starts unarmed
- split bodies must spawn non-overlapping and inside legal arena space
- merge sums surviving HP without healing
- deterministic equipment merge, no duplication
- merged footprint must be physically correct; do not leave anchor permanently shrunk

Do not fake precision if the unit/meaning of +/-25 is not actually frozen; keep it an explicit tuning slot rather than inventing hidden authority.

A2 Damage Shedding:
- CD 16s, active 5s
- each 100 realized damage -> child, carry-over yes
- max 3
- child HP 140 transferred from SLIME health
- lifetime 5s, radius 45, speed 90%
- targetable, may physically pick/use weapons
- expiry returns surviving HP to nearest valid living SLIME Body
- killed child HP stays lost
- expiry may not delete the final valid living HP

Passive Emergency Mitosis:
- per Body at 80% reference-HP loss
- split current HP equally
- each half >=100, otherwise no split
- successful split replaces source, no HP duplication
- creation state defines new reference HP
- death only when no living Body remains

Use seeded gameplay RNG. No raw `Math.random()` in ROBOT/SLIME gameplay.

## Large-hit hitch diagnostic
Owner saw SLIME freeze/hitch on sniper/large hits. Heavy precision hits also have intentional hit-stop.

Use real Chromium and the real production damage path:
1. controlled heavy hit on SLIME;
2. same weapon/hit-stop on comparable non-SLIME target;
3. measure frame/long-task timing around impact;
4. inspect synchronous split/child creation cost;
5. distinguish intentional hit-stop from SLIME-specific jank.

Report measured values. Do not invent a pass threshold. Do not reduce blood/splatter/VFX to make performance look better.

## Scope discipline
You may change shared Hero runtime only as required for locomotion/ROBOT/SLIME correctness.

Do NOT opportunistically repair CRYSTAL, MAGNET, BLACK_HOLE, MATH, ICE, RUBBER, HUNTER, TIME, MIRROR or SNIPER semantics in this task.

BLACK_HOLE visual work is being handled separately by the owner. Do not touch it.

The owner-failure audit also found HeroDefinition contract drift. Confirm it. Do not pretend the whole 12-Hero contract is repaired unless you actually repair it. Do not turn this pilot into a full architecture rewrite.

## Required behavioral gates
Movement gates must observe real moving fighters. Do NOT use `baseSpeed=0`, `__hrHoldBody`, body pinning, or disabling the behavior being tested.

Shared:
- unarmed rework Hero does not turn toward off-heading pickup without cast
- armed Hero does not chase/kite opponent
- normal wall bounce survives

ROBOT:
- idle ROBOT does not seek pickup
- A1 explicitly turns/dashes
- T6 excluded
- pickup requires physical contact
- A2 exact DR/no CC immunity
- Passive uses real ladder source or explicit blocker

SLIME:
- split conserves HP + area
- no overlap at spawn
- independent movement/bounce
- no child autopilot
- seeded split reproducible
- merge HP/footprint correct
- no equipment duplication
- A2 threshold carry-over/max3/140HP transfer
- expiry returns surviving HP
- killed child HP lost
- emergency split 80% / min100 / no duplicate HP
- children outside `fighters[]`
- last-body/promotion remains valid

Browser:
- controlled Robot-vs-SLIME heavy-hit timing comparison

## Preserve
- canonical 12 playable roster
- NEWBIE->ROBOT migration
- 20-stage Quest identities
- T6 manipulation immunity
- Stormbreaker 446 and existing frozen flight/stun laws
- SLIME children outside fighters[]
- CP7 menu/audio/readiness
- blood/splatter
- weapon aim independent from movement
- no raw gameplay setTimeout
- no force-push
- no final-art/VFX redesign

## Hard fail shortcuts
Do not:
- fix all 12 Heroes;
- reintroduce hidden steering;
- make movement tests green by freezing bodies;
- invent ROBOT thresholds;
- use raw Math.random in ROBOT/SLIME;
- duplicate HP/equipment;
- put SLIME children in fighters[];
- reduce blood/VFX to hide cost;
- bypass real pickup/damage/weapon paths with toy logic;
- call CI green owner acceptance;
- call Hero Rework complete.

## Durable checkpoints
Push at least:
Q1 shared locomotion + real movement gates
Q2 ROBOT correction + gates
Q3 SLIME A1/base multi-body physics + gates
Q4 SLIME A2/passive + hitch evidence
Q5 full regression/build + final report

Do not wait until Q5 to push Q1-Q4.

## Final report
Provide:
- branch
- pushed SHAs in order
- files changed
- root causes
- targeted gate results
- full-suite/build results
- browser hitch measurements
- ROBOT Passive threshold-source conclusion
- unresolved items
- one testable preview commit

End with exactly:
`ENGINEERING CANDIDATE READY FOR OWNER ROBOT+SLIME PLAYTEST — NOT OWNER ACCEPTED`

Do not give yourself a qualification verdict. The director/owner decides whether this model is trustworthy enough for the remaining 10 Heroes.
