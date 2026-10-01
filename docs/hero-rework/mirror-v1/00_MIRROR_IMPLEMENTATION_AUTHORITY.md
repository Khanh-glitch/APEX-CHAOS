# MIRROR V1 — IMPLEMENTATION AUTHORITY

## 0. Mission

Implement MIRROR into the real APEX CHAOS Arsenal Quest runtime while preserving the canonical Gold 12 appearance/feel and adapting MIRROR-specific game mechanics to Gold where the owner approved Gold-first behavior.

This is **not** a redesign. It is **not** a generic mirror-themed recreation. It is a Gold-to-production bridge.

## 1. Authority precedence

When sources conflict, use this order:

1. **Owner-approved Gold-first mechanic lock in this package** (`08_GOLD_FIRST_MECHANIC_LOCK.md`).
2. **Canonical Gold 12 executable HTML** for visual appearance, motion, VFX, authored timing, temporal personality, A1/A2 choreography, shard formation, node geometry/surface behavior and routing choreography.
3. Approved APEX balance/data law only for production rules Gold does not model fully (cooldowns, real weapon payload/ammo, shard damage formula/lifetime, T6/shield exclusions, native movement/environment).
4. Current production code as a migration baseline only. Current behavior is not authority when it conflicts with 1–3.
5. Historical Mirror prototypes/prompts are non-authoritative.

No green test, code architecture, or prior implementation can override a visible Gold mismatch.

## 2. Gold visual law — absolute

The production result must look and feel like Gold 12 at normal battle scale and in close inspection:

- split central identity with distinct left/right personality;
- same plate hierarchy, surface/material treatment, seam, hidden backing, false-reflection family and asymmetry;
- authored stale/wrong reflection roles and timing;
- actual temporal history behavior, not decorative orbit/bobbing;
- same start/stop/hard-turn/contact personality grammar where production supplies the corresponding real event;
- A1 must visibly catch the real opponent weapon as an image, keep it flat on the mirror surface, peel that image, reform it, then materialize the real copy;
- A2 must show two local wrong-person reflection states and snap the real coordinates at the canonical beat; no dash/portal/tunnel substitution;
- passive shards must be image-bearing Mirror fragments; five physically align and build the node; node routing is image-in-surface -> image-at-destination -> object-out;
- no generic portal circles, rune rings, magic beams, crystal-loot shards, generic neon substitutes, or a second visual language layered over Gold.

**Do not preserve the existing temporary circular shard/mirror renderer for MIRROR.** Once Gold presentation owns these entities, the generic world renderer must not double-draw them.

## 3. Gold temporal engine

Canonical Gold runs presentation/state at:
- fixed step `1/120 s`;
- maximum 12 fixed substeps per display frame;
- excess accumulator is discarded when the cap is hit.

Production MIRROR Gold state must have one clock owner. Never drive the authored spring/history system once from AQ.step and again from rAF.

Gold 12's temporal history is itself part of the accepted artifact:
- `HN = 64`, `HS = 22`;
- false-face base delays: UL `.095`, UR `.115`, LL `.145`, LR `.17` seconds;
- wrong reflection adds `.45 s` sampling offset;
- history channels include root, expression, gap/slip/ghost/gaze, velocity, both main-half transforms and opponent coordinates.

Do **not** silently “improve” the 64-sample visible semantics by expanding effective sampling history. A larger internal buffer is allowed only if sampling is clamped to canonical Gold-equivalent history so the visible output remains parity-true.

## 4. Integration architecture

Preferred architecture, following the successful direction from later Crystala/Frost/Magnet work while correcting Magnet's bridge mistakes:

- `mirrorGoldV1.js` — canonical Gold-derived state/render engine. It owns visual geometry, temporal history, part motion, A1/A2 authored phase state, node visual state, exact transform math and drawing. It exports canonical constants/geometry/surface transforms rather than forcing production to duplicate them.
- `mirrorGameplayRuntime.js` — real game truth adapter for MIRROR. Owns real weapon copy transaction, real shards/nodes, real projectile escrow/routing and semantic events. It references Gold contract values instead of copying timing/geometry literals independently.
- `mirrorPresentationRuntime.js` — thin adapter from real gameplay truth/events into Gold state and draw seams. No second hand-authored Mirror look.

If a smaller architecture can prove stronger direct parity, it is allowed. The ownership principles are not optional.

### Effective shipping renderer / wrapper-chain gate

Do not blindly add another `Fighter.prototype.draw` wrapper because the final parent already has layered Robot/Hunter/Crystala/Frost/Magnet presentation hooks and the effective shipping renderer may differ from the nominal engine renderer. Before choosing the Mirror draw seam:
- inspect the final transplanted parent's actual draw call chain and effective QA/shipping renderer;
- preserve existing post-world/bloom/distortion interop and call order for non-MIRROR actors;
- ensure P1 MIRROR, P2 MIRROR and MIRROR-vs-MIRROR all render exactly once;
- prove no existing presentation adapter is bypassed by Mirror early-return logic;
- prefer a narrow actor/presentation hook over another global wrapper when the final baseline exposes one.

This requirement comes directly from Frost render-state failures and Magnet's discovery that the effective shipping renderer, not the nominal draw function, owned the visible seam.

### Forbidden architecture

- a reduced Gold module plus a second “pretty” adapter that reimplements half the effects;
- self-validating reconstructed Gold tests that never execute the canonical HTML;
- generic Canvas/SVG redraw of the character while claiming Gold parity;
- duplicated geometry constants in gameplay and presentation that can drift;
- a MIRROR-specific second movement integrator fighting APEX movement;
- global renderer mutations that affect unrelated fighters;
- persistent changes to camera scale/fighter radius to make the art fit;
- raw `setTimeout` for gameplay semantics.

## 5. Production seam order

Gold 12 step order is meaningful: character/opponent movement -> A1/A2 state -> springs -> projectiles -> shards/nodes -> history.

Production adaptation should preserve the causal equivalent:

1. Ability intent/cooldown may be accepted in the normal pre-tick AbilityController.
2. Native APEX fighter movement/collision owns root movement.
3. MIRROR post-movement state advances exactly once; this is where A1 OWN and A2 SNAP transitions must be resolved so they correspond to the positions actually drawn that frame.
4. Real projectile integration reaches the MIRROR surface transform before body hit resolution; route/capture uses swept interaction where needed.
5. Shard/node formation advances after projectile interaction for the frame, matching Gold's ordering.
6. Post-state root/expression/opponent history sample is pushed once.
7. Draw uses the completed state and must restore canvas state unconditionally.

Do not let the existing `AIL.hrScheduler.tick()` pre-movement seam become the A2 snap owner merely because it is convenient; Gold snaps after its movement step.

## 6. Real-asset adaptation inside signature events

Gold demo uses a generic weapon drawing because it is a standalone prototype. Production must preserve the **Gold choreography** while using the **actual weapon identity**:

- A1 REFLECT/PEEL uses the real captured weapon's actual game sprite/render identity, clipped and transformed by Gold's plate/slice math;
- after OWN, the real Arsenal holder/renderer owns the usable weapon; do not double-render a second Gold weapon;
- Gold overlays may add restrained Mirror-authorship cues without hiding real weapon identity.

Likewise A2 reflection imagery should derive from the actual opponent actor/silhouette at the Gold-defined local reflection sites. Do not substitute a generic purple person/portal.

## 7. Multi-instance law

Gold has one MIRROR instance. Production MIRROR-vs-MIRROR must extend that state safely:

- each MIRROR combatant owns an independent Gold/history/RNG/presentation state;
- shards form nodes only with shards from the **same owner**;
- node active cap is **3 per MIRROR owner**;
- each owner's routing network selects destinations within that same owner's active nodes;
- no shared mutable false-face/history scratch between MIRROR instances;
- deterministic stable combatant order when multiple MIRROR render passes share a stage.

This is the faithful production extension of a single-instance Gold; do not allow cross-owner shard formation or shared node-state contamination.

## 8. Acceptance hierarchy

Passing order:
1. canonical source identity;
2. mechanic causality;
3. canonical Gold trace parity;
4. actual real-game object integration;
5. normal-scale browser visual parity;
6. cross-hero regression;
7. build/performance/teardown;
8. **owner visual/feel acceptance**.

Automated green is never equivalent to step 8.
