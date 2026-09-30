# FROST V1 — ZERO-CONTEXT HANDOFF

A new Arena model must be able to execute Frost without chat history.

## Project truth

Repository: Khanh-glitch/APEX-CHAOS
Post-CRYSTALA-V2 baseline: 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae
Reference branch: arena/01a0f1e7-apex-chaos
Preload branch: director/frost-v1-preload-20260930

Do not modify/push to the reference branch.
Stay on the Arena-assigned implementation branch and push only there.

## What Frost is

FROST is the product-facing replacement for the canonical storage identity ICE.

Core:
A1 creates persistent directional Frozen Floor and can freeze revealed battlefield firearms.
A2 is a 3s native-inertia Hunt window that freezes Frost's actual path; real body contact Cold-Shocks and, when Frost is unarmed, steals the enemy's exact live firearm holder.
Passive lets Frozen Gun shots roll Freeze.

Old ICE bullets/lane/continuous-chill gameplay is obsolete for product Frost.

## The two truths

Gameplay:
00_FROST_IMPLEMENTATION_AUTHORITY.md

Presentation:
gold/FROST_GOLD_APEX_PHYSICS_ACCURATE_V2_FIXED.html
SHA-256 940fc9a8a181cc40d965ebf2c4309d1b4816d3016fc191b0d3df8a1a65be2475

The exact 981,597-byte Gold at the path above is selected. Do not substitute the obsolete 975,616-byte Gold, the later Signature prototype, or any prior generated Frost Gold JS.

## Most dangerous historical mistakes

1. Do not invent global steering. APEX heading/inertia/bounce is a product law.
2. Do not turn A1's ~0.25s cast into a movement stop/position lock; corrected Frost keeps native locomotion running.
3. Do not let Gold renderer motion feed back into production body movement.
4. Do not fake contact from an animation endpoint; real physics contact is truth.
5. Do not call equip() for A2 steal: it resets holder state.
6. Do not roll shotgun Freeze per pellet.
7. Do not layer Frost onto old ice.* mechanics.
8. Do not let legacy iceVisualRuntime render old ICE block/text/audio over Frost Gold.
9. Do not make a test pass by pinning/zero-speeding the body when the test claims to prove locomotion.
10. Do not treat CI green as visual/feel acceptance.
11. Do not keep large unpushed local work; Arena workspaces can disappear.

## Baseline facts already audited

- heroRegistry still selects old ICE mechanics and must be migrated to frost.* under stable storage ID.
- HR.shellUpdate is already corrected to native inertia; preserve it.
- engine anchor collision already separates 50/50 and reflects dirs; reuse it.
- weapon equip() creates a fresh holder with READY / elapsed 0 / shotsFired 0; forbidden for steal.
- holder lives at fighter.data.arsenal and is suitable for an exact transfer primitive; for multi-body opponents, query the current authoritative equipment carrier instead of assuming the colliding Body owns it.
- shotgun/autoshot pellet emission lacks a shared semantic blast id; add the narrowest grouping hook.
- spawn pickup resolver has no Frozen-slot eligibility rule; add the narrowest slot eligibility/metadata hook.
- iceVisualRuntime keys old freeze visuals/audio to ICE source identity; Frost needs semantic suppression.
- Arsenal weapon aim is independent of fighter dir; do not couple them.

## Scope philosophy

Prefer:
1. Frost-local code.
2. narrow generic hooks with zero behavior change when Frost is absent.
3. explicit regression gates.

Do not refactor shared systems just because the current architecture is imperfect.

## Deferred

Frost-specific SFX.
Lv2-Lv5 progression design.
Final post-playtest balance.

No agent discretion to fill these gaps.


## Final owner-playtest blockers

The current production playtest exposed release-blocking presentation failures: A2 ice is visibly disconnected from itself and differs from Gold; activating A1/A2 can make ice flicker/disappear and can make the opponent repeatedly scale up/down; Frost's battle-scale visual is smaller than peer fighters; additional visual defects may exist. These are presentation/isolation failures, not permission to retune gameplay. Read 09_FINAL_GOLD_REBUILD_AUTHORITY.md and rebuild the presentation from the exact canonical Gold.
