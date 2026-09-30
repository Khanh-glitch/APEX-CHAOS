# CRYSTALA V2 — SIX-SHARD PHYSICAL RESOURCE AUTHORITY
Date: 2026-09-30
Status: owner-directed design freeze for implementation
Repo/branch: Khanh-glitch/APEX-CHAOS / arena/01a0ee80-apex-chaos
Pre-V2 runtime baseline: 35b599ec57a959edc72c0d28619f1f819c1c1902

## 0. Intent

CRYSTALA must NOT be "the reflect hero" with three versions of the same answer.
Her identity is:

> Six visible, persistent crystal shards are a physical resource. Power comes from assigning those six bodies between mobile guardianship, a brittle lane wall, and an all-in six-shard prison.

Every strength must create a readable weakness. Avoid invisible arbitrary timers when shard state itself can create the decision.

Preserve the approved Gold visual language and the current no-quality-cut performance optimizations. This V2 is a gameplay/state-authority rewrite, not an art redesign.

---

## 1. Canonical fighter geometry

Live engine:
- Fighter radius = 75 px.
- Fighter diameter = 150 px.

Owner target for successful K interception:
- about 1.5 fighter diameters OUTSIDE the fighter edge.
- 75 + (1.5 × 150) = **300 px from Crystal center**.

Therefore:
- K successful contact ring = **300 px center radius**.
- Do NOT rescue inward to 180/150/120/90 px.
- A valid K block should visually happen far away from Crystal's body.

---

## 2. Shared shard resource

Gold identities remain unchanged:
- shard 0 = BLADE L
- shard 1 = BLADE R
- shard 2 = GUARD L
- shard 3 = GUARD R
- shard 4 = SENT ↑
- shard 5 = SENT ↓

Only ORBIT is free/available.

All abilities consume the SAME physical shards. Never clone hidden gameplay shards.

A shard can be:
ORBIT -> guardian job / construct travel -> return -> ORBIT.

Individual return is independent. No global shard recovery state.

---

## 3. J / A1 — contextual construct, independent of K for Wall

### Frozen tuning
- J cooldown: **8.0 s**
- fail consumes cooldown: false
- input buffering: false

REMOVE the V1 artificial laws:
- remove `requiresAwakening: true` as a universal J requirement
- remove `decisionWindow: 1.2`
- remove `maxCastsPerAwakening: 1`

The 8 s J cooldown is already longer than K's 2.4 s active window, so double-J-in-one-K is naturally prevented without an invisible timer rule.

### Input resolution

On J press:

1. If K is ACTIVE AND all six shards are exactly ORBIT/free:
   -> cast HEXA PRISON.

2. Otherwise:
   -> attempt WALL using specifically BLADE L + BLADE R (shard ids 0 and 1).

3. WALL succeeds only if both Blade shards are exactly ORBIT/free.
   - K may be OFF or ON.
   - If either Blade is busy/returning/anchored: fail, no cooldown.

This creates visible resource conflict:
- Wall removes both heavy Blade guardians from any later K until they visibly return.
- K with an existing Wall may therefore have only 4 guardian shards.
- If all six are free during K, J is Hexa, not Wall.

---

## 4. WALL — smart brittle anti-volume lane defense

Role:
- good against spray/burst/volume fire
- bad against high-caliber / high-penetration shots
- should absorb/reflect PART of a burst, then crack and let the rest through

### Frozen first-pass tuning
- shards: **BLADE L + BLADE R only**
- width: **220 px**
- total HP: **80**
- Gold build/material lock target: keep **~0.75 s**
- solid lifetime: **4.0 s max**
- J cooldown: shared **8.0 s**

### Placement / reflection
Keep the current smart enemy-oriented placement:
- place the wall between Crystal and opponent using the existing enemy direction / offset logic.
- keep fixed-plane physical/specular reflection.
- do NOT add homing/correction toward opponent.
- "smart reflect direction" should come from good wall orientation, not magical aim correction.

### BRITTLE BREAKTHROUGH LAW

Structural damage is evaluated against remaining wall HP BEFORE reflection is committed.

If projectile damage < remaining Wall HP:
1. projectile reflects from the real wall plane;
2. Passive applies once (50% current damage at Lv1);
3. wall loses structural HP normally.

If projectile damage >= remaining Wall HP:
1. the wall takes the full structural hit and breaks;
2. that breaking projectile is **NOT reflected**;
3. projectile keeps its current owner, velocity, critical/provenance and **full current damage**;
4. it passes through the destroyed wall on the same ballistic leg;
5. tag it as a Crystal Wall breakthrough so K cannot immediately erase the intended Wall weakness by intercepting that same projectile after it broke through.

Do NOT convert to "remaining damage only". Owner intent is full projectile damage on the breaking shot.

T6 existing non-reflect/shatter authority remains unchanged.

### Expected current Arsenal interactions at 80 HP (non-crit, x7 equipment scale)
Examples:
- P90 2.1×7 = 14.7 -> roughly 5 reflected hits, 6th breaks through.
- AK-47 3.4×7 = 23.8 -> roughly 3 reflected, 4th breaks through.
- M16 4×7 = 28 -> roughly 2 reflected, 3rd breaks through.
- Mossberg pellet 3.8×7 = 26.6 -> roughly 3 pellets worth of HP; breaking pellet and later pellets pass.
- Magnum .500 9×7 = 63 -> first can reflect, second breaks through.
- MBR 16×7 = 112 -> first shot breaks through.
- MBR2 14×7 = 98 -> first shot breaks through.
- compat SNIPER 26×7 = 182 -> first shot breaks through.

Crits naturally break sooner.

---

## 5. K / A2 — reactive Guardian Perimeter, NOT omniscient hit prediction

Role:
- excellent answer to isolated heavy projectiles such as sniper/precision
- intentionally inefficient into spray/volume
- no HP: a shard cannot be "shot through" like Wall
- weakness is finite six-body occupancy and slow individual return

### Frozen first-pass tuning
- cooldown: **12.0 s**
- active: **2.4 s**
- guardian read/trigger radius: **600 px**
- successful interception/contact ring: **300 px from Crystal center**
- six independent shard slots
- internal refraction: preserve Gold **0.16 s**
- recoil beat: preserve Gold **0.16 s**
- contact -> visible dock total: **1.60 s**
  - therefore gameplay RETURN_T target becomes **1.28 s** if REFRACT and RECOIL remain 0.16 + 0.16
- aborted/baited guardian should remain meaningfully busy; first-pass abort return target **1.0 s**
- T6 remains immune

### REMOVE V1 smart-body predictor

Delete K's dependency on:
- "would this projectile truly hit Crystal?"
- earliest body collision target prediction
- blocker-first body-hit prediction as a prerequisite
- damage-priority threat ranking
- 1000->180 smart anticipation/rescue-band logic
- inward rescue bands 180/150/120/90
- `minAnticipation` as gameplay eligibility

K is a reactive perimeter, not perfect AI.

### Reactive trigger law

An eligible hostile reflectable projectile becomes a guardian event when it is first observed:
- inside the 600 px guardian radius,
- outside the 300 px contact ring,
- moving generally inward toward Crystal,
- not T6,
- not already Crystal-reflected,
- not already assigned/tagged by this K window.

IMPORTANT:
- K does NOT need to know whether the projectile would eventually hit Crystal.
- A grazing/near-miss shot entering the guardian perimeter may waste a shard.
- This is intended counterplay and part of Crystal's weakness into volume/bait.
- A projectile first appearing at/inside the 300 px contact ring is a point-blank breach and is too late for K to claim. No teleport rescue.

Determinism:
- if several projectiles enter in one tick, order by actual perimeter-entry TOI within that tick; tie by stable projectile id/order.
- do NOT rank by damage.

### Shard assignment

Choose an ORBIT shard primarily by shortest physical travel to the intended far guard contact, stable id tie-break.
Do not prefer a shard merely because it is a "guard" role; all six are guardian capacity.

Every projectile owns at most one shard job.
Every shard owns at most one projectile job.

### Far interception geometry

For a projectile whose path crosses the 300 px ring:
- target the real 300 px ring crossing.
- launch the selected shard immediately.
- use the SAME Gold Hermite/facet/refraction/recoil grammar.
- compress outbound travel as necessary to the real remaining crossing time.
- no teleport; the moving shard still needs a real swept shard-projectile contact.

For a grazing projectile that triggered at 600 but never reaches the 300 ring:
- the shard still visibly commits/attempts;
- if no real contact occurs, use a Gold-style banking/abort return;
- shard stays unavailable until visible dock.

Successful K contact must not silently move inward toward the body.

### Capacity weakness

Six simultaneous eligible guardian events may consume all six shards.
The 7th event is unserved until a specific shard visibly docks.
Each shard's recovery is independent.

This is the intended anti-volume weakness.

---

## 6. HEXA PRISON — all-in spatial control

Role:
- NOT the best raw projectile defense
- all-in control / trap / zoning / damage-window creation
- epic because all six shards abandon guardianship and form a real cage

### Cast requirement
J casts Hexa only when:
- K is active
- all six shards are exactly ORBIT/free
- J cooldown is ready

Any shard busy with K, Wall, return, or another construct makes Hexa unavailable.

This naturally creates the decision:
- immediate K -> J Hexa before any shard responds
vs
- keep K guardians active and risk losing the six-free condition.

### Frozen first-pass tuning
- radius: **135 px**
- facets: 6
- facet HP: **60 each**
- Gold build/material lock: **~0.75 s**
- solid lifetime: **3.0 s**
- all 6 shards committed
- no invisible/root containment

### Counterplay / shatter
- opponent may leave during the visible ~0.75 s closure if geometry permits.
- once solid, a broken facet creates a REAL physical gap.
- do NOT require two broken facets to move out; one real missing facet is the physical exit.
- requiring two would need an invisible/non-physical blocker and is rejected.

Hexa is RESONANT, unlike brittle Wall:
- a projectile that destroys a Hexa facet still follows the existing reflect-first transaction for that hit;
- then the facet breaks and opens a gap for later movement/projectiles.
- therefore high-caliber can open an escape route quickly, but the opening shot itself is denied/reflected.

Crystal's own projectiles continue to follow existing owner-material interaction law; do not invent a new invisible cage exception without owner review.

---

## 7. Passive — Refraction Mastery

Keep:
- reflected projectile current damage × **0.50** at Lv1
- applied exactly once
- controller/owner becomes Crystal on actual reflection
- preserve valid crit/provenance
- no second Arsenal x7
- max one Crystal reflection per projectile lifetime
- T6 non-reflectable

Do not add body-auto-reflect.

---

## 8. Resulting matchup identity

WALL:
- strong vs frontal sustained volume
- loses to high-caliber penetration
- static/fixed lane
- Blade resource cost

K:
- strong vs isolated sniper/precision shots
- cannot be structurally penetrated
- loses efficiency to spray, bait, and point-blank breach
- finite six independent slots + 1.60 s individual recycle

HEXA:
- weakest per-face structural defense
- strongest spatial control
- opponent can escape closure, or break a real facet to open a gap
- requires perfect six-free K state
- commits ALL guardian capacity

No one option should be a scalar "better reflect".

---

## 9. Cross-hero differentiation

Do not turn Crystal into:
- Robot A2 but stronger: Robot reduces broad incoming damage; K is projectile-only, finite-body, baitable and point-blank breachable.
- Magnet A2 but stronger: Magnet continuously pushes bodies/projectiles; K is six discrete physical interceptions.
- Black Hole A1 but stronger: Singularity stores/releases up to 8 with preserved payload; K reflects via mobile physical shards with reduced return damage and long recycle.
- Mirror but stronger: Mirror's portal economy is generated from realized damage and routes neutral projectiles; Crystal pre-allocates six persistent bodies before damage.

---

## 10. Implementation hotspots / complexity warning

This is NOT a one-line tuning pass.

Expected files:
- public/game/hero-rework/heroRegistry.js
- public/game/hero-rework/crystalGameplayRuntime.js
- public/game/hero-rework/heroMechanicsRuntime.js only if context routing requires it
- public/game/hero-rework/heroReworkRuntime.js only if collision pass-through integration requires it
- public/game/hero-rework/crystalaPresentationRuntime.js only for truthful HUD/readability, not visual redesign
- tools/testCrystalaGameplayGates.mjs
- tools/analyzeCrystalaDecisionTradeoffs.mjs
- tools/profileCrystalaPerformance.mjs if new scenarios are needed
- runtime manifest + runtimeRevision.lock after final code

High-risk areas:
1. replacing body-hit predictor with perimeter-event acquisition while keeping real moving-shard TOI;
2. breaking Wall projectile continuing through the same frame without re-hitting removed material;
3. ensuring Wall breakthrough projectile is not immediately swallowed by K;
4. J routing K-off Wall vs K-on six-free Hexa;
5. fixed Blade identities interacting with K/return/construct states;
6. preserving deterministic shotgun/multi-projectile behavior;
7. preserving Gold and current performance improvements.

---

## 11. Mandatory acceptance gates

### J / Wall
- K OFF + Blade 0/1 ORBIT + J ready -> Wall succeeds with shardIds exactly [0,1].
- K OFF + either Blade busy -> J fails; cooldown remains 0.
- K ON + <6 free + both Blades free -> Wall.
- J cooldown exactly 8.0 after successful Wall.
- no input buffer.

### Hexa
- K ON + exactly six ORBIT + J ready -> Hexa.
- any one shard non-ORBIT -> Hexa does not cast.
- six-free K state uses all six shards.
- facet HP exactly 60; real gap after one facet dies.

### K acquisition
- projectile entering 600 radius but whose trajectory would miss body still commits one shard.
- projectile never entering 600 commits none.
- projectile first observed <=300 commits none (point-blank breach).
- no damage-based threat priority.
- six simultaneous eligible entries -> six distinct shards.
- seventh is unserved until one individual shard docks.
- individual dock immediately reopens exactly that shard.

### K contact geometry
- successful block contact radial distance from Crystal ~=300 px with tight tolerance; never rescue at 180/150/120/90.
- fastest real SNIPER at realistic muzzle distance is physically intercepted when first observed outside 300 and a shard is free.
- shard uses real swept contact, not teleport.
- contact->dock ~=1.60 s.
- K cooldown exactly 12.0.

### Wall brittle breakthrough
- with Wall 80 HP, a compat SNIPER hit destroys Wall and is NOT reflected.
- the breaking projectile keeps full current damage/provenance and can damage the body.
- no same-projectile K rescue after Wall breakthrough.
- lower-damage spray bullets reflect until the breaking bullet; later bullets pass after Wall is gone.

### Hexa resonant shatter
- high-caliber breaking facet hit is still reflected once.
- facet is then dead and its physical capsule disappears.
- next projectile through that gap is not blocked by the dead facet.

### Regression
- T6 unchanged.
- own projectile / reflected projectile anti-loop laws unchanged.
- no new global projectile owner bugs.
- Hunter/Robot unchanged.
- Gold parity/readability remains.
- performance profile does not regress materially versus current construct-cache baseline.

---

## 12. Do not do

- do not lower VFX quality to make the mechanic easier.
- do not clone invisible shards.
- do not use a global K cooldown between shard blocks.
- do not reintroduce body-hit omniscience under another name.
- do not let Wall breaker reflect then pass.
- do not make Hexa two-facet escape via invisible collision.
- do not modify Robot/Hunter/Black Hole/Magnet/Mirror to compensate.
- do not change shared engine unless the Crystal integration genuinely cannot be solved locally; document and gate any unavoidable shared edit.
