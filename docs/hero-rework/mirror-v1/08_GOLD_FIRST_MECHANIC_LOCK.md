# MIRROR — GOLD-FIRST FULL HERO BEHAVIOR LOCK

Status: **OWNER APPROVED**  
Canonical visual/mechanic donor: `gold/MIRROR_GOLD_FUSION_12.html`

## 1. Core rule

Gold 12 is authoritative for MIRROR-specific causality, timing, state transitions, spatial interaction, formation, routing and presentation-linked behavior.

APEX remains authoritative only for balance/data systems that Gold does not model completely.

## 2. A1 — MIRROR ARSENAL

### APEX balance/data retained
- cooldown: **15 s**; cooldown begins on accepted cast;
- fresh same eligible weapon instance;
- real weapon damage/ammo/shots/projectile behavior remain native Arsenal truth;
- opponent keeps original;
- T6/Stormbreaker excluded;
- SWIRL_SHIELD / TOWER_SHIELD excluded;
- invalid/unarmed target is a real whiff and **still consumes cooldown**;
- if MIRROR already holds equipment when the copy materializes, preserve the current normal equip/replace transaction semantics; never duplicate/drop an extra weapon unless the normal equip path itself says so.

### Gold-first behavior
- capture/snapshot exact eligible opponent-held weapon at cast time;
- later opponent drop/swap/death does not invalidate a valid captured image;
- no usable copy exists at cast time;
- canonical timeline: `A1TS = 1.6 s`;
- NOTICE/LOCK/REFLECT/PEEL/REFORM run from the Gold state machine;
- OWN threshold is `u >= .58`; under canonical 1/120 stepping the real edge occurs on the first fixed step crossing that threshold (nominal 0.928 s, fixed-step realization about 0.933 s);
- create/equip the real copy **on the Gold OWN edge**, not from an independent approximate timer;
- copy lifetime = **6 s starting at materialization/OWN**;
- A1 action visually ends at `u >= .92` (nominal 1.472 s, fixed-step crossing approximately 1.475 s);
- Gold also keeps its presentation `busy` recovery envelope at about **2.2 s** from cast; this suppresses unrelated idle choreography but does not block movement or extend the gameplay A1/A2 overlap lock beyond `A1.on`;
- MIRROR can continue native APEX movement during the action;
- A1 and A2 cannot overlap their authored action windows; this lock is not a movement root;
- if MIRROR dies before OWN, no copy materializes;
- if a copied weapon is replaced later by a real pickup/equip, expiry must not consume the replacement.

Whiff follows Gold's whiff choreography but never creates a reflected/solid copy.

## 3. A2 — MIRROR EXCHANGE

### APEX balance/data retained
- cooldown: **12 s**;
- each Combatant keeps own HP, weapon and statuses.

### Gold-first behavior
- canonical `A2TS = 1.0 s`;
- telegraph/snap beat = `u = .25` = exactly **0.25 s** at 1/120;
- resolve after the frame's normal movement, matching Gold's movement->A2 order;
- snapshot both fighters' **current live positions at the snap edge** and exchange those exact coordinates;
- do not use cast-time coordinates;
- do not add travel path, dash, tunnel, safe-corner relocation or arbitrary offset;
- each fighter keeps its own velocity; no reset/inversion/exchange;
- swap is simultaneous/atomic **also to synchronous observers**: snapshot both endpoints, write both final coordinates first, then emit relocation/snap events. The current generic `RelocationTransaction.commit()` implementation writes+emits one move at a time, so it must not be used unchanged if an event listener can observe the half-swapped intermediate state; use a narrow Mirror-local batch or safely correct the shared primitive with full regressions;
- after arrival, normal APEX overlap/contact physics resolves normally; do not fabricate skipped-path contacts;
- Gold history is translated/rebased, not cleared;
- canonical slow/latest identities keep post-swap residue (`LL extraDelay .12`, LR wrong reflection `.5 s`);
- action visual state ends around `u=.64`;
- Gold keeps a presentation `busy` recovery envelope of about **1.8 s** from cast; preserve the idle/recovery feel without turning it into a gameplay root or an extended ability lock;
- MIRROR may continue native movement throughout.

## 4. Passive — damage to shard

Gold does not model real APEX damage amounts, so keep APEX balance law exactly and make the formula explicit:

```
if realizedDamage < 20: 0 shards
else: clamp(round(realizedDamage / 35), 1, 5)
```

- count only realized damage actually suffered by a MIRROR-owned body;
- free shard lifetime: **6 s**;
- T6 manipulation immunity remains for the T6 object itself, **but realized damage from a T6 hit may still generate MIRROR shards** because the passive reacts to MIRROR HP loss and does not manipulate the T6 object;
- shard spawn inherits real hit event position/direction/identity state for presentation, but count comes from the formula above.

Do not replace this with Gold's demo projectile-power accumulator.

## 5. Passive — formation

Gold-first production law, per MIRROR owner:

- free shard becomes formation-eligible only when `age > .7 s`;
- scan cadence: Gold-equivalent **0.3 s**;
- need 5 eligible shards of the same owner;
- Gold topology is **seed radius**, not all-pairs radius:
  - choose an eligible seed;
  - sort other same-owner eligible free shards by distance to seed;
  - if the fourth-nearest is `<170 px`, reserve seed + four nearest;
- committed shards leave FREE state immediately and cannot be claimed by another formation;
- normal 6 s free-shard expiry stops/pauses once reserved;
- node centroid comes from the five shards and is clamped only as needed to keep the accepted Gold node surface inside the legal arena; do not import the demo arena's literal 90/910/100/900 boundaries as universal game constants;
- node orientation uses the Gold range `[-.35,+.35] rad` but production uses match-seeded gameplay RNG because orientation affects the gameplay capture surface;
- shard assembly starts at `.18 + i*.06 s` ordered by travel distance; each travel duration `.4 s`;
- surface fill starts only after all five arrive; Gold fill/lock window is roughly `.04-.34 s` after lock start and becomes ACTIVE just after `.38 s`;
- typical canonical formation start->ACTIVE is about **1.20 s**;
- routing is impossible before ACTIVE.

## 6. Passive — node lifecycle and network

Per MIRROR owner:
- maximum **3 ACTIVE routing nodes** per owner;
- preserve Gold's **4 node-lifecycle slots per owner** so concurrent assembly/fold overlap cannot grow unbounded and high-rate formation behaves like the executable Gold; unlike the free-shard pool, this 4-slot node lifecycle bound directly affects visible/state concurrency and is therefore retained;
- when a new formation begins with the Gold threshold condition met and an ACTIVE node is available to retire, the oldest ACTIVE node enters fold state instead of silently rejecting the formation; if all 4 lifecycle slots are occupied, formation waits until a slot frees exactly as the Gold pool does;
- fold/despawn duration: about **0.55 s** (`fold` reaches full over first `.5 s`);
- ACTIVE lifetime: **10 s starting when the node reaches ACTIVE**, not at formation reservation;
- same-owner nodes form the routing network; opposing MIRROR networks do not cross-route or cross-form;
- presentation and gameplay share one node transform/orientation authority.

The Gold demo's **16-shard pool** is not imported as a production balance cap because the owner explicitly retained APEX free-shard lifetime semantics. The **4 node-lifecycle slots are retained** for Gold-equivalent formation/fold concurrency as stated above.

## 7. Passive — eligible routed object families

The old implementation was known PARTIAL because transforms covered only selected projectile branches. Production MIRROR must consistently route **detached eligible projectile entities**, using capability/type semantics rather than ad hoc weapon names:

Eligible at minimum:
- firearm bullets, burst/auto bullets and shotgun pellets (each actual projectile entity);
- grenade projectile;
- normal thrown melee projectile;
- transformed/replayed versions of the above when they remain valid detached projectiles.

Not eligible:
- direct melee swing/contact;
- shields;
- persistent fields;
- Hero Active state itself;
- T6/Stormbreaker or another object denied by capability authority.

## 8. Passive — surface capture and routing

Use Gold's oriented node surface, not a circular portal radius.

Canonical Gold node local polygon:
`[[-5,-60],[28,-27],[20,28],[0,62],[-28,31]]`

Canonical route surface is the segment from local vertex 0 to local vertex 3 after node transform.
Gameplay and presentation must call the same transform authority.

For a moving projectile, use a swept segment/capsule test against the node surface so high-speed Arsenal shots cannot tunnel.

Gold-equivalent thresholds:
- image/preview region: ~**34 px** from surface;
- actual capture region: ~**17 px** from surface, expanded by real projectile radius where appropriate;
- preview never removes the real projectile;
- capture requires another ACTIVE node in the same owner's network; with only one valid node, the projectile remains in WORLD and is not escrowed/routed. Gold still gives the touched node its local ripple/image response and applies an approximately **0.40 s** local recapture/capture-attempt cooldown to that projectile before it may try a mirror surface again.

Destination:
- nearest other ACTIVE same-owner node by node-center distance from the entry node, matching Gold's routing policy.

## 9. Passive — escrow choreography

On capture:

`WORLD -> MIRROR_ESCROW -> WORLD`

- preserve projectile class, real payload, damage, critical state, direction/velocity, provenance/generation tags and remaining lifecycle state;
- remove it from normal world collision while escrowed;
- pause its ordinary world lifetime/fuse/grace/max-flight timers during the 0.56 s mirror transit; Gold stops normal projectile life while in transit and AIL requires explicit stored-object policy;
- do not allow Magnet/world fields/body collision to act on an escrowed entity;
- entry surface retains image memory;
- at ~**0.20 s** destination reflected image becomes visible before emergence;
- destination is selected once at capture and is **not retargeted** mid-transit. If that destination is no longer `on` at emergence, Gold falls back to the entry node; production must retain a captured entry-node transform so release is still defined even if that node finishes folding before the 0.56 s release edge;
- at ~**0.56 s** real object emerges at the canonical Gold-equivalent destination offset: Gold uses **node center + incoming unit direction × 20 Gold-world px**. If production applies a non-1:1 Gold-to-world node scale, scale this offset through that same transform; do not replace it with a portal-radius jump. If destination is gone, apply the same rule to the captured fallback entry transform;
- set previous-position/swept-history origin to the emergence point so no phantom collision is tested along the teleport gap;
- controller becomes **NEUTRAL**;
- damage unchanged;
- provenance retained;
- neutral object may hit either side and gives no normal Hero gameplay credit/milestone/passive progress;
- post-exit MIRROR recapture lock: ~**0.45 s**; this is not damage immunity;
- valid later routing through another node is allowed after the lock; no global one-portal cap.

## 10. Native APEX laws not imported from Gold demo

Do not import these demo values as MIRROR mechanics:
- fighter speed 250;
- fighter radius 34;
- demo acceleration/deceleration 1700/2100;
- wall rebound .12;
- arena 1000x1000 as a Hero law;
- generic projectile speed 420;
- demo projectile lifetime/reset values;
- demo opponent AI;
- demo projectile-power shard accumulator;
- absence of free-shard expiry.

Native APEX movement, collision, weapon/damage/crit and arena laws remain authoritative unless explicitly overridden above.
