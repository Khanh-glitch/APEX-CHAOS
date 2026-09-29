# APEX CHAOS — CRYSTALA V1 IMPLEMENTATION AUTHORITY
Date: 2026-09-30
Status: OWNER-DIRECTED IMPLEMENTATION AUTHORITY
Product hero id: `CRYSTAL`
Visual identity codename: `CRYSTALA`

## 0. Mission
Port the owner-approved executable Gold into production CRYSTAL while replacing the old Crystal gameplay with the latest owner-approved K-Awakening / J-context-construct system.

This is NOT a redesign. The Gold remains the appearance/choreography authority; the real APEX runtime remains gameplay truth.

The standalone Gold still demonstrates old semantics (`J=wall`, `K=prison`, `P=intercept`). Those controls and demo combat are rejected as production gameplay truth. The approved visual algorithms, shapes, timing grammar, material behavior and motion remain authoritative.

## 1. Mandatory CRYSTALA implementation baseline
Repository: `Khanh-glitch/APEX-CHAOS`
Required branch: `arena/01a0ead6-apex-chaos`
Required gameplay baseline commit: `00d83e76d248c49ca65d8e546c67819d07a0d758`
Baseline runtime revision: `20260930-hunter-ownerfix-r1`

This commit is the owner-approved baseline **after the latest Hunter owner-playtest fixes**. CRYSTALA implementation must inherit those fixes.

Before writing any CRYSTALA implementation:
1. inspect `git status --short`, current branch and HEAD;
2. `git fetch` the remote branch;
3. fast-forward forward so `00d83e76d248c49ca65d8e546c67819d07a0d758` is in the current branch ancestry, then continue from the latest remote descendant;
4. verify ancestry rather than copying files between histories.

Hard history law:
- do **not** reset/checkout back to the old preload SHA;
- do **not** rebase or cherry-pick the preload again;
- old preload construction SHAs are historical package provenance only, never the implementation start point;
- if current remote HEAD is already a descendant of `00d83e76d248c49ca65d8e546c67819d07a0d758`, continue forward from that HEAD and never move backward.

A later prep descendant may carry cache-bust revision `20260930-crystala-prep-r1` only because owner-test currency was added; that does not redefine the gameplay baseline above.

At the audited baseline code:
- registry still contains old Crystal Wall 11s / Prison 20s / always-on 50% body-reflect;
- `heroMechanicsRuntime.js` still executes old Crystal wall/prison;
- `heroReworkRuntime.js` still contains old body `tryReflect`;
- rework J already bypasses the legacy 1s manual-gate buffer through `HR.pressAbility(...,'A1')`;
- rework K already has a direct KeyK -> A2 bridge inside the rework runtime;
- therefore DO NOT add another KeyK listener and DO NOT invent legacy `pressK`;
- current movement-wall resolution is not universal: Hunter has wall-aware movement, while Robot A1 can update x/y directly;
- latest Chamber/readability pass is live and must remain intact.

## 2. Authority order
If anything conflicts:
1. owner's latest explicit instruction;
2. this file for gameplay/input/numbers;
3. `01_OWNER_APPROVED_GOLD_REFERENCE.html` for asset/visual/VFX/motion identity;
4. `02_GOLD_TO_GAME_ADAPTATION_MAP.md`;
5. current live production architecture at implementation HEAD;
6. older Crystal docs/baseline.

The Gold must never own fake demo HP, damage, cooldowns, arena, opponent movement, target truth or controls.

## 3. Protected continuity
Do not redesign/refactor Robot, Hunter, Chamber, weapon balance, spawn/heal/crit laws, menu/meta/quest, audio architecture, or unrelated heroes.

Preserve current proven laws:
- one actor source render per frame under Chamber separation;
- status/VFX layers outside the actor silhouette source;
- equipped weapons render only through Arsenal's single weapon dispatch;
- no full-actor hue/filter rewrite;
- runtime-revision/cache-bust discipline remains green.

Direct edits to Robot/Hunter/Chamber runtime semantics are protected. Prefer Crystal-specific adapters and the smallest generic shared hook. Under unattended one-shot execution, a protected blocker does not stop the whole task; preserve the protected behavior, finish all independent work, and report only the residual blocker at the end.

## 4. Frozen V1 numbers
Do not self-tune these during the first implementation.

### Six immortal shards
- total shards: **6**
- shard HP: none
- shard destruction/reconstruction: none
- physical availability is the resource system

### K / A2 — AWAKENING
- cooldown: **8.0s**
- active: **2.4s**
- dormant: shards orbit, dark, no interception
- active: shards glow/awaken; eligible real threats can be intercepted

### J / A1 — CONTEXT CONSTRUCT
- usable only during active K
- cooldown: **1.5s**
- snapshot only truly ORBIT/AVAILABLE shards at the J input edge
- 6 available -> PRISON
- 2–5 available -> WALL using 2 shards
- 0–1 -> immediate fail; no cooldown
- NO input buffering: failed J never auto-fires when shards later return

### WALL
- 2 shards
- width **220px**
- HP **120 total**
- solid lifetime **4.0s**, starting when visual/material reaches lock
- fixed reflective plane
- real physical movement blocker only once visible material is solid

### PRISON
- 6 shards
- radius **135px**
- 6 facets
- HP **75 per facet**
- solid lifetime **3.0s**, starting at closure
- six real physical walls; NO invisible/root containment

### PASSIVE — REFRACTION MASTERY
- no automatic body block/reflect
- Lv1 reflected damage = **50% of the projectile's current damage at reflection**
- passive progression only scales reflected-damage magnitude
- no second Arsenal x7
- no new crit roll
- preserve valid crit/provenance
- reflected leg ownership/controller -> Crystal

### T6
- Stormbreaker/T6 remains non-reflectable
- existing final-authority/T6 wall-shatter behavior stays intact

## 5. Progression mapping
Do not invent extra mechanics just to satisfy the registry one-knob law.
- A1 Construct: one `constructHpMult`-style knob applies coherently to Wall 120 and Prison facet 75; Lv2–Lv5 curve remains unresolved.
- A2 Awakening: `cooldown`.
- Passive: `reflectedDamagePct`.
Never level shard count, threat radius, intercept radius, or create shard HP.

## 6. Shard state / availability law
Gameplay resource states:
`ORBIT -> RESERVED/PREPARE -> OUTBOUND -> INTERCEPT/REFRACT -> RECOIL/RETURN -> ORBIT`

Construct path:
`ORBIT -> CONSTRUCT_TRAVEL -> ANCHORED_CONSTRUCT -> RETURN -> ORBIT`

Hard rules:
- only ORBIT is AVAILABLE to J;
- reservation immediately makes shard unavailable;
- reservation must immediately produce visible anticipation, so unavailable state is never invisible;
- construct shard cannot defend with K;
- availability returns on the exact visible docking/rejoin frame;
- if K remains active after docking, shard can intercept again in the SAME K;
- K is a continuous guardian window, not six charges;
- if K expires, stop assigning new threats, but already committed jobs complete/refraction/return normally.

## 7. Smart K threat law
Do not use proximity-only defense. A shard should only leave formation for a hit Crystal would actually take.

### Eligible threat iff all are true
- hostile to Crystal;
- reflectable firearm/native projectile under current projectile authority;
- not T6/Stormbreaker;
- not melee/contact/blast/beam/field/DoT;
- not already Crystal-reflected;
- not already reserved;
- enough remaining lifetime;
- without Crystal intervention, Crystal is the earliest real collision target along the swept trajectory;
- no solid Wall/Prison/other blocker will collide first.

Prediction must account for projectile velocity + Crystal current movement.

### Scan / contact geometry
- threat scan radius: **1000px**
- intercept/contact band: **180px from Crystal center**
- 1000px is prediction only, not instant reservation
- intercept near the predicted 180px trajectory crossing; never chase a bullet across arena

Reason for 1000: audited fastest firearm is about 5800px/s. 1000->180 gives about 0.14s for a stationary Crystal; the older 800 candidate gave about 0.107s and was too thin for the desired anticipation.

### Reservation / reachability
`0.12s` is a minimum anticipation beat, NOT a blind fixed timer.
- predict time/point at 180px crossing;
- choose an ORBIT shard that can physically reach it using Gold travel grammar;
- reserve just in time;
- reserve earlier only if actual shard travel requires it;
- never teleport a far-side shard;
- never leave a visually idle shard locked for an arbitrary long interval.

### Assignment
For simultaneous real threats:
1. earliest predicted time-to-hit;
2. tie -> higher current damage;
3. tie -> stable projectile ID/order;
4. one distinct available shard per projectile.

Each shotgun pellet is an independent threat only if that pellet individually would hit. Never collapse a whole blast into one magical block.

Once OUTBOUND, do not jitter-retarget every frame. If the threat disappears/is blocked, use a Gold-style abort/banking return; remain unavailable until docked.

## 8. Intercept / reflection transaction
At real shard-projectile contact:
1. cancel the incoming hit immediately;
2. orient/use the Gold real facet/contact grammar;
3. play Gold internal-light refraction;
4. compute reflected velocity;
5. apply Passive multiplier exactly once to CURRENT projectile damage;
6. preserve valid critical/provenance;
7. change owner/controller to Crystal;
8. mark projectile as Crystal-reflected;
9. release outgoing leg;
10. shard recoils/curves home and docks.

A projectile may be Crystal-reflected **at most once** for its lifetime. No Prison pinball and no repeated Passive multiplication. Crystal-owned reflected projectiles must not hurt or re-reflect from Crystal's own construct surfaces.

K reflection uses the moving shard/facet geometry. Do NOT port the standalone Gold's 25% correction/homing toward the fake foe as gameplay law.

J Wall/Prison reflection uses the real fixed facet plane, so it is more predictable than K.

Normal target mitigation still applies after reflection; Robot A2 must still reduce incoming reflected damage if active.

## 9. Return timing
Frozen first-pass target:
- real contact -> internal refraction/recoil -> return -> visible docking = **1.20s total target**
- this includes the Gold internal-light beat (~0.16s)
- gameplay AVAILABLE flips exactly at docking
- preserve Gold Hermite/tangent continuity; tune trajectory speed within the 1.20s target rather than using an invisible cooldown
- the 180px contact band keeps the return distance visually coherent

## 10. J construct decision and same-frame law
J snapshots available ORBIT shards at the INPUT edge, before new threat assignments of that same frame:
- 6 -> Prison
- 2–5 -> Wall
- 0–1 -> fail

This removes nondeterministic J-vs-threat races.

J cooldown begins only on successful construct cast.

## 11. Gold Wall adaptation
Port the Gold Wall appearance/motion/material algorithm, not its demo HP/lifetime/gameplay.

Preserve:
- exact six shard identities;
- two shard peel/sweep/anchor motion;
- dense 13-cell ~220px crystal material;
- opposing growth fronts;
- seam/zip-lock;
- impact cracks/chips/stress;
- support-failure cascade;
- restrained debris/dust/bloom.

Production differences:
- choose **any 2 AVAILABLE shards** by min-travel/end-point assignment; Gold's hard-coded BLADES-only selection is rejected as gameplay;
- gameplay HP is aggregate 120, not Gold per-cell HP;
- Gold cell HP/stress are presentation state driven by real damage fraction/contact position;
- visual cascades never subtract extra gameplay HP;
- solid lifetime is 4.0s from material lock;
- final destroying hit is still blocked/reflected first, then Wall breaks;
- both anchor shards survive, detach, Gold-style return, become AVAILABLE only at docking.

## 12. Gold Prison adaptation
Preserve:
- all-six outward burst/encircle;
- angular/min-travel assignment;
- six physical edges;
- same dense A1 material language on each side;
- chain growth;
- last-gap closure;
- failure/debris language;
- foreground/back layering.

Production differences:
- radius 135;
- all six AVAILABLE required;
- no demo `foe.locked`, root, or scripted containment;
- gameplay containment is only real physical edges;
- during early encircle, cage center may follow the real target by pure translation for presentation continuity;
- **freeze cage center at NUCLEATE/start of physical material growth**; the forming cage must not chase thereafter;
- HP 75 per facet, not cell HP;
- a destroyed facet opens a real gap;
- no invisible collision across destroyed facet;
- surviving shards never break.

## 13. Gold build-time fit
Raw Gold Wall/Prison reach solidity in about 2.0–2.1s, too slow for the new 2.4s K/J interaction.

Do NOT delete phases or redraw motion. Retime the pre-solid timelines globally/proportionally to a **~0.75s target to solidity/closure** while preserving:
- phase order;
- path geometry;
- curves/tangents;
- dense material-growth identity;
- impact readability.

Collision activates only where visible material has actually grown/locked. No invisible instant wall.

Construct remains after K expires according to its own solid lifetime.

## 14. Movement collision / anti-tunnelling
Once construct material is solid, it must stop:
- normal locomotion;
- Robot A1 dash;
- Hunter pounce;
- equivalent high-speed authored displacement.

Do NOT patch Robot/Hunter mechanics directly if a minimal shared swept segment/capsule wall-resolution authority can solve it. This is a shared geometry truth, not a Crystal-specific nerf of another hero.

Destroyed Prison facets cease collision immediately.

## 15. Hostile-only / self-interaction
- K intercepts hostile eligible projectiles only.
- Crystal-owned projectiles do not wake K.
- Crystal-owned/projectiles already reflected by Crystal do not reflect again on Crystal constructs and do not damage them.
- regular enemy projectiles can damage constructs through the real gameplay damage transaction while being reflected/blocked according to this authority.
- thrown melee may preserve existing world-wall ricochet behavior, but K guardian interception does not intercept thrown melee in V1.

## 16. Preserve Gold exactly where it is appearance authority
Must preserve:
- Crystala body/crown/face/eye identity;
- all 6 individual stone silhouettes/roles;
- spring-damper orbit with inertial lag;
- elliptical orbit + redistribution;
- Hermite travel/return momentum continuity;
- real facet indexing/orientation at intercept;
- internal-light contact->exit path inside the gem;
- recoil/banking return;
- restrained separated trail motes, not neon ribbons;
- Ancient Dust bounded pooling/flow;
- authored emissive half-res bloom; dark silhouette stays crisp;
- Wall density/growth/material lock;
- Prison six-side dense wall language;
- break cracks/chips/debris/support cascade;
- depth layering/front/back read.

Do NOT replace the Gold with generic particles, circles, SVG approximations, screenshots, sprite cuts, or a simpler procedural substitute.

## 17. Architecture precedent: Hunter lesson
The proven Hunter pass established the correct separation:
- Gold/executable module owns authored art/motion;
- presentation adapter binds real game state to Gold;
- real mechanics own gameplay;
- real debuff state drives Gold status art;
- expensive actor source renders once;
- FX layers stay outside Chamber actor silhouette;
- weapon renders only in Arsenal weapon pass.

Apply this architecture to Crystala.

Expected shape (names may vary only if live architecture materially suggests better):
- `crystalaGoldV6.js` — ported Gold art/motion/VFX, gameplay-neutral;
- `crystalaPresentationRuntime.js` — thin real-state/event adapter;
- Crystal-specific changes in registry/mechanics;
- minimal shared projectile/world/movement hooks;
- manifest wiring;
- Crystal-specific tests/capture tools.

## 18. Old mistakes to explicitly avoid
- do not “think then write” without rereading the whole law/diff;
- do not treat standalone demo gameplay as production authority;
- do not approximate an approved Gold visually because a simpler effect is easier;
- do not duplicate game truth in presentation;
- do not add duplicate input listeners;
- do not hide gameplay-unavailable shard state while it still visually looks idle;
- do not create shard HP/destruction/charges/UI meters;
- do not let K block bullets that would miss or hit a Wall first;
- do not create whole-shotgun magical blocks;
- do not allow multiple shards on one projectile;
- do not allow multi-reflection pinball;
- do not let construction collision exist before visible material;
- do not make Prison an invisible root;
- do not let Gold visual stress cause extra gameplay damage;
- do not alter Robot/Hunter/Chamber semantics for convenience;
- do not spend time on long evidence reels before durable checkpoint push.

## 19. Crash-safe implementation checkpoints
### Checkpoint A — mechanics / truth
Implement new Crystal config, K/J/Passive transaction, shard semantic state, smart threat prediction, real construct HP/lifetimes/reflection, physical collision truth, deterministic gates.
Then:
- focused tests;
- diff review;
- commit;
- push;
- remote verify SHA.

### Checkpoint B — Gold presentation
Port Gold algorithms faithfully; bind real state/events; Chamber-safe one-source actor render; focused real-browser visual parity.
Then:
- diff review;
- commit;
- push;
- remote verify SHA.

### Checkpoint C — integration/evidence
Run Crystal-vs-Robot matrix, regression suites, build, cache/revision checks, real browser evidence, final diff audit.
Then:
- commit;
- push;
- remote verify SHA.

Do not record an expensive long owner reel before A/B are durable.

## 20. Unattended blocker policy
This implementation is expected to run one-shot while the owner may be absent. Do not pause the whole task for a question.

If the required baseline is not in canonical-source ancestry, do not invent history: preserve the session branch, complete no destructive reconciliation, and treat that as a final blocker. If a Crystal requirement appears to demand direct Robot/Hunter/Chamber semantic edits, preserve those protected semantics, exhaust Crystal-specific and minimal generic shared-hook options, then finish every other independent part and report only the residual item at the end. If current architecture invalidates one owner decision, isolate that item and continue all unrelated work.

Ordinary complexity, test writing, a known pre-existing harness failure, or needing a Crystal-specific adapter is never a reason to stop the one-shot run. Operational details are authoritative in `06_ONE_SHOT_RUNBOOK.md`.
