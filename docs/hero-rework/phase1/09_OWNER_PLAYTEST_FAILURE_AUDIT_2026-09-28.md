# HERO REWORK — OWNER PLAYTEST FAILURE AUDIT

Date: 2026-09-28  
Baseline audited: `2071dcf34acc4fed6f92fee3ea72a0e5d00fb2d7`  
Status: **OWNER GAMEPLAY VALIDATION FAILED — 12/12 HEROES REJECTED**

This document supersedes any earlier wording that treated Hero Rework Phase 1 as gameplay-complete.

The previous campaign proved that the code could pass its own automated gates. It did **not** prove that the 36 mechanics faithfully implemented the frozen Hero authority or preserved the original APEX CHAOS movement/feel laws.

## 1. Owner result

Owner manually tested all 12 playable Heroes and reported that all 12 failed expectations and even basic skill-accuracy expectations.

Therefore:

- CI green is not owner acceptance.
- 334/334 headless, 15/15 smoke, 11/11 goldens and 217/217 browser are regression evidence only.
- The current Hero Rework baseline must be treated as a failed owner-playtest implementation.
- Do not continue feature expansion, visual integration or balance work on top of these mechanics until semantic correction is complete.

## 2. Systemic root causes confirmed in source

### S1 — Global movement autopilot illegally replaces base APEX movement

`HR.shellUpdate()` continuously steers reworked bodies:
- toward nearest revealed pickup when unarmed;
- toward/away from opponent to maintain a hold band when armed.

All 12 canonical rework shells call this generic movement layer.

This violates the original APEX movement identity: baseline fighter locomotion should preserve its heading/inertia and change through normal wall/body bounce unless a specific Hero mechanic explicitly overrides movement.

This one defect contaminates owner perception of every Hero.

### S2 — SLIME children use the same illegal autopilot

`childAI()` calls `HR.shellUpdate()`, so split bodies chase pickups/opponents instead of behaving as independent physical APEX bodies.

### S3 — Hero Definition Contract is not actually represented by the registry

The owner-approved contract requires Hero-level fields including:
- `schemaVersion`
- `definitionVersion`
- `bodyProfileRef`
- `baseTargetingPolicyRef`
- `aiPolicyRef`
- `presentationProfileRef`
- `assetManifestRef`
- `telemetryNamespace`

The current `heroRegistry.js` has none of these Hero-level fields.

The implementation therefore does not satisfy the frozen Hero Definition Contract even though comments claim the registry is the canonical contract implementation.

### S4 — AI decision authority is replaced by a generic cooldown spammer

The contract requires one Hero-level `aiPolicyRef` as the decision authority.

Current `p2CastAI()` simply waits a deterministic 0.4–1.0s after readiness and attempts both A1 and A2 whenever cooldown is available, retrying conditions every 0.5s.

That is not Hero-specific decision logic.

### S5 — RelocationTransaction claims safe contact handling but does not implement it

AIL comments say relocation checks source/destination contacts and provides safe relocation semantics.

Actual `RelocationTransaction.commit()` only writes `x/y` and emits `Relocated`.

There is no safe-destination resolution and no source/destination contact handling.

This affects MIRROR Exchange, TIME Rewind and SNIPER Farthest Corner.

### S6 — Test suite masked the locomotion regression

Hero goldens explicitly disable cast/movement AI, and several browser/headless gates pin bodies with zero speed or `__hrHoldBody`.

The suite therefore did not protect the product's base locomotion law.

### S7 — Several object-manipulation mechanics only support `aq_bullet`

Multiple mechanics described as acting on projectiles/objects only run inside the `aq_bullet` path:
- CRYSTAL refraction
- BLACK_HOLE transit storage
- MATH graph/gates
- RUBBER compression
- parts of MAGNET projectile manipulation

Grenades/thrown melee/other eligible object families are inconsistently omitted.

### S8 — SLIME uses raw `Math.random()`

SLIME Mitosis, Damage Shedding and Emergency Mitosis use raw `Math.random()` instead of the seeded Hero RNG, violating deterministic gameplay/replay expectations.

---

## 3. 36-mechanic fidelity audit

Legend:

- **FAIL** = explicit contradiction, missing mechanic, or materially wrong behavior.
- **PARTIAL** = substantial mechanic exists but the frozen law is incomplete/contaminated.
- **LOCAL MATCH / CONTEXT FAIL** = local executor roughly matches the frozen law, but the Hero still fails owner playtest because global runtime behavior contaminates it.
- **REVIEW** = source wording leaves an ambiguity that must be resolved before another implementation pass.

| Hero | Skill | Audit | Source/runtime finding |
|---|---|---|---|
| ROBOT | A1 Weapon Dash | LOCAL MATCH / CONTEXT FAIL | Explicit A1 dash correctly targets nearest revealed non-T6 pickup with 3400 speed, 0.55s max and 11 rad/s turning. However the generic shell autopilot already seeks pickups outside A1, destroying the skill's identity and base movement law. |
| ROBOT | A2 Virtual Armor | LOCAL MATCH / CONTEXT FAIL | 3s / 55% DR / no CC immunity is represented. Owner experience remains contaminated by global locomotion. |
| ROBOT | Passive Damage Milestones | **FAIL** | `milestoneThresholds: null`; executor only records cumulative damage and deliberately never refunds cooldown. This passive is not functionally implemented. |
| CRYSTAL | A1 Crystal Wall | **FAIL** | Wall is destructible to projectiles/thrown weapons, but fighter bodies never collide with it. Frozen law says real physical/destructible geometry. |
| CRYSTAL | A2 Crystal Prison | **FAIL** | Six walls spawn, but because walls do not block fighter bodies the prison cannot physically confine the opponent as specified. |
| CRYSTAL | Passive Refraction | PARTIAL | Bullet reflection preserves payload, flips controller to CRYSTAL and halves damage. It only runs on the bullet path; other projectile/object families are not consistently handled. |
| MAGNET | A1 Magnetic Acquisition | LOCAL MATCH / CONTEXT FAIL | Physical pickup-slot pull, acceleration, cap and T6 exclusion are represented. Base Hero locomotion is still globally wrong. |
| MAGNET | A2 Repulsion Field | PARTIAL | Fighter push and bullet radial impulse exist. Projectile handling is narrower than the generic “eligible projectile” law and does not consistently cover all object families. |
| MAGNET | Passive Magnetic Acceleration | **FAIL** | Frozen law explicitly requires projectile/**thrown** velocity +18%. Executor only applies when descriptor kind is `bullet`; thrown melee is not boosted. |
| BLACK_HOLE | A1 Singularity Transit | **FAIL** | Frozen law specifies **two-singularity object transit**. Implementation creates one singularity and releases stored bullets near the nearest body after a delay. It is also bullet-only rather than general eligible-object transit. |
| BLACK_HOLE | A2 Damage Singularity | LOCAL MATCH / CONTEXT FAIL | 1s escrow, cap, 65% return, 3s x2 vulnerability and T6 exclusion are substantially represented. Needs owner feel validation after locomotion correction. |
| BLACK_HOLE | Passive Event Horizon | LOCAL MATCH / CONTEXT FAIL | Growth from realized HP loss and radius cap are represented; larger radius affects physical body footprint. Owner feel still unaccepted. |
| MATH_V2 | A1 Parabola Graph | **FAIL / PARTIAL** | A parabola world entity exists, but it only blocks `aq_bullet` in the current pass rather than all eligible spatial damage sources. Registry also contradicts authority with `healPickupDoesNotEnd: false` while frozen authority says heal pickup does not end the graph. |
| MATH_V2 | A2 Damage Equation | LOCAL MATCH / CONTEXT FAIL | Credited Math/opponent counters, physical-collision cashout, armor HP=sum, no direct damage payout and 3s armor are substantially represented. |
| MATH_V2 | Passive Multiply/Divide | PARTIAL | x2/div2 gates exist and transform bullets. Eligibility coverage is narrower than the generic projectile law; exact separation angle remains an allowed tuning slot. |
| ICE | A1 Ice Bullets | LOCAL MATCH / CONTEXT FAIL | Active window tags owned bullets with CHILL. |
| ICE | A2 Ice Lane | LOCAL MATCH / CONTEXT FAIL | Windup, width, speed, zero direct damage and CHILL lane are represented. |
| ICE | Passive Deep Freeze | **FAIL** | Executor iterates ICE's **own bodies**, not chilled enemy bodies. It can therefore accumulate/freeze the wrong side. It also does not reset accumulation when CHILL ends, violating “continuous CHILL”. |
| RUBBER | A1 Elastic Kinetic State | PARTIAL | Energy, speed bonus, threshold stun and decay exist. Exact impulse calibration is explicitly unresolved by authority, so current calibration is provisional rather than owner-proven. |
| RUBBER | A2 Projectile Compression | PARTIAL | Bullet storage, capacity, slow, radial release and debt return exist. Storage only intercepts bullet path, not all potentially eligible projectile families. |
| RUBBER | Passive Afterbounce | LOCAL MATCH / CONTEXT FAIL | Push, self slow preserving heading conceptually, recontact lock and no stun are substantially represented. |
| HUNTER | A1 Snare Trap | LOCAL MATCH / CONTEXT FAIL | One trap, 8s lifetime and 1.6s root on enemy body contact are represented. |
| HUNTER | A2 Pounce + Weak | PARTIAL | Windup, straight pounce, 0 direct damage and Weak exist. Collision is discrete position overlap rather than swept contact, so lower frame-rate/high-step tunneling remains possible. |
| HUNTER | Passive Killer Instinct | **FAIL** | `tryDodge` rejects any projectile without `p.__hr`, so ordinary untagged Arsenal bullets cannot trigger the passive. The “physical dodge” is implemented as a 95px relocation jump rather than physical movement. |
| TIME | A1 Time Loop | **REVIEW / LIKELY FAIL** | Runtime continuously records the previous rolling 2s before cast and immediately schedules replays. The frozen wording “record window: 2s; replay: 2 loops x2s” can reasonably imply cast→record→replay. Owner rejected the skill, so temporal sequencing must be re-confirmed before reimplementation instead of assuming the current interpretation. |
| TIME | A2 Rewind | PARTIAL | HP/position restore after 3s exists and no revive is respected. “Velocity” is represented only by `dir`; real velocity/push/speed state is not snapshotted. Safe relocation authority is also not implemented by RelocationTransaction. |
| TIME | Passive Timeline Markers | LOCAL MATCH / CONTEXT FAIL | Recent position history is recorded as information-only state. Final presentation remains owner-unaccepted. |
| MIRROR | A1 Mirror Arsenal | LOCAL MATCH / CONTEXT FAIL | Fresh eligible weapon copy, opponent retains original, T6/shields excluded and whiff consumes cooldown are substantially represented. |
| MIRROR | A2 Mirror Exchange | PARTIAL | Delayed atomic coordinate swap is represented and own HP/weapon/status are not exchanged, but it depends on the incomplete RelocationTransaction safe-relocation primitive. |
| MIRROR | Passive Shattered Mirrors | PARTIAL | Damage→shards→mirrors and neutral bullet/grenade routing exist. Routing is not consistently implemented for every eligible projectile family. |
| SLIME | A1 Mitosis | **FAIL** | Spawn offset (12,8) causes deep body overlap after radius reduction; generic child autopilot immediately steers bodies; `divergenceTarget` is not actually used as a configured magnitude; raw `Math.random()` violates seeded RNG; merge does not restore the original footprint/radius. |
| SLIME | A2 Damage Shedding | **FAIL** | HP transfer/child count/lifetime exist, but child movement is the wrong generic autopilot and spawn direction is raw `Math.random()`. Owner observed severe hitching on large hits; performance still needs real-browser profiling. |
| SLIME | Passive Emergency Mitosis | **FAIL** | Threshold/min-share logic exists, but split spawn overlaps, uses raw `Math.random()`, and resulting bodies inherit the same incorrect movement system. |
| SNIPER | A1 Farthest Corner / AimLost | **FAIL / PARTIAL** | Farthest-corner relocation and AimLost timer exist. During AimLost, `resolveEnemyBody` returns null; weapon `enemyAlive()` then becomes false, preventing normal ready weapons from activating instead of allowing “last aim” firing. Relocation safety is also incomplete. |
| SNIPER | A2 Sniper Nest | LOCAL MATCH / CONTEXT FAIL | Movement lock, predictive pre-shot intercept and spread scaling are substantially represented. |
| SNIPER | Passive Distance Crit | LOCAL MATCH / CONTEXT FAIL | Distance-step bonus and 55% total cap are represented. Owner still rejected overall Hero behavior in the contaminated runtime. |

## 4. Result of the 36-mechanic audit

The current implementation should **not** be described as “36 mechanics implemented correctly”.

A more accurate state is:

- several executors locally resemble the frozen design;
- multiple core skills are explicitly wrong or non-functional;
- shared runtime primitives violate the frozen architecture;
- global locomotion contaminates all 12 Heroes;
- automated tests were constructed in ways that bypassed key owner-facing behavior.

This is a systemic implementation-fidelity failure, not a normal polish pass.

## 5. Required correction strategy

### Step A — freeze the failed baseline

Keep `2071dcf34acc4fed6f92fee3ea72a0e5d00fb2d7` as the failed owner-playtest reference.

Do not “clean up” or rewrite it in place.

### Step B — correct shared laws before individual Heroes

Before Hero-specific repair:

1. remove generic pickup/chase/kite steering from baseline rework locomotion;
2. make normal reworked bodies obey the original APEX heading + collision/bounce law;
3. make SLIME bodies obey the same physical law independently;
4. implement the actual Hero Definition Contract structure;
5. replace generic P2 cooldown spam with a real Hero-level AI-policy boundary;
6. repair RelocationTransaction safe-contact semantics;
7. centralize eligible-object capability handling instead of bullet-only special cases;
8. eliminate gameplay `Math.random()` from Hero mechanics.

### Step C — correction pilot: ROBOT + SLIME only

Do not repair all 12 simultaneously.

First prove:

**ROBOT**
- base movement is original APEX locomotion;
- no pickup steering outside A1;
- A1 alone performs Weapon Dash;
- A2 remains correct;
- Passive has an explicit owner-resolved threshold authority before it is called complete.

**SLIME**
- split is area/HP-conserving;
- bodies spawn non-overlapping;
- each body preserves physical heading/bounce;
- no generic chase/kite/pickup steering;
- seeded divergence;
- merge restores correct footprint;
- A2 large-hit path does not produce a frame hitch beyond intentional hit-stop;
- body death / Combatant survival remains correct.

Only after owner accepts ROBOT and SLIME should the same corrected primitives be applied to the other 10.

### Step D — new acceptance law

A Hero is not complete because:
- syntax passes,
- headless passes,
- goldens pass,
- browser gates pass,
- CI is green.

A Hero is complete only after:
1. sentence-level authority fidelity audit,
2. real-browser behavioral proof,
3. regression suite,
4. owner gameplay acceptance.

## 6. Current-model decision support

The previous implementation campaign demonstrated useful persistence in:
- Git recovery,
- CI/test debugging,
- branch reconciliation,
- mechanical investigation.

However it also demonstrated severe weaknesses for autonomous design-faithful implementation:
- it introduced a global movement system not authorized by the design;
- it failed to implement the frozen Hero Definition Contract fields;
- it left at least one Passive intentionally non-functional while still reporting the campaign complete;
- it produced explicit source contradictions;
- it allowed tests to mask major owner-facing regressions;
- it repeatedly optimized for green gates rather than semantic fidelity.

Therefore the current model should not be trusted to autonomously repair all 12 Heroes in one pass.

Recommended use:
- stop the current implementation task;
- preserve its remote work;
- open a new Arena chat/model;
- first give the new model a bounded ROBOT+SLIME correction qualification task;
- only expand scope if the new model proves sentence-level fidelity and owner-playable results.

