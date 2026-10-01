# MAGNET V1 — ZERO-CONTEXT HANDOFF

## Project truth
Repository: `Khanh-glitch/APEX-CHAOS`
Baseline: `5411906a741f87d637ee20535c82e96b866d4ab2`
Preload branch: `magnet-v1-preload-20261001`
Current baseline runtime revision: `20261001-frost-v1-ice-eye-boost-r1`

The baseline branch audited before preload was `arena/01a0f581-apex-chaos` and was identical to the SHA above.

## Gold truth
`docs/hero-rework/magnet-v1/gold/MAGNET_FINAL_DONOR_MAX.html`
3,095,049 bytes, 1,242 logical lines,
SHA-256 `468f7b2aa34588c2c52bf23fb5202c507ff5d584d423ea9f1a9232d751247d8b`.

No chat attachment is required after preload. Verify the Git copy before coding.

## Live baseline Magnet state — DO NOT mistake it for latest authority
Current registry still contains old Magnet:
- A1 cooldown 10, single-nearest pull, 1500 accel, cap 1000, 2s.
- A2 duration 2.2, radius 210, older force values.
- Passive bullet x1.18.

Current A1 implementation repeatedly moves one slot and stores `pick.speed` on a transient wrapper. It is not persistent real velocity/momentum.
Current A2 pushes bodies/bullets but does not implement latest floor-gun repel law.
There are no sufficient latest-brief Magnet-specific gates.

Therefore do not incrementally tweak the old executor into a giant multi-purpose block.

## Recommended architecture
New dedicated gameplay truth:
`public/game/hero-rework/magnetGameplayRuntime.js`

Owns:
- A1/A2 gameplay field windows;
- collection of all active Magnet fields;
- one-per-world-step floor firearm physical integration;
- floor collision/contact state;
- firearm-bullet velocity manipulation;
- passive launch modifier eligibility;
- T6 immunity;
- telemetry/inspect/teardown.

Gold engine / production art bridge:
`public/game/hero-rework/magnetGoldV1.js`
(or an equivalent smaller generated/hand-ported module produced from the exact Gold).

Presentation adapter:
`public/game/hero-rework/magnetPresentationRuntime.js`

`heroMechanicsRuntime.js` should keep Magnet executors thin.
`heroReworkRuntime.js` should expose only the narrow global hook needed for one-per-tick force/projectile ordering.
Registry owns locked configuration.
Runtime manifest loads modules in deterministic order.

Asset target:
`public/assets/hero-rework/magnet-v1/**`
pre-baked from the exact Gold Reference-A pipeline, not re-derived every frame.

## Projectile ordering
Magnet field changes eligible projectile velocity before the normal projectile movement of that tick.
Then the existing pipeline owns:
movement -> world/construct interactions -> graph/gate -> singularity -> Mirror portal -> body/Crystal/Rubber transactions.

Do not duplicate the projectile resolver.

## Shared-hook rule
Before touching a shared Arsenal/engine surface:
1. prove Magnet-local code cannot express the semantic;
2. add the narrowest generic/no-op-when-Magnet-absent hook;
3. gate Magnet behavior and baseline non-Magnet behavior;
4. do not refactor unrelated systems.

Protected semantics:
ROBOT, CRYSTAL, BLACK_HOLE, MATH_V2, FROST, RUBBER, HUNTER, TIME, MIRROR, SLIME, SNIPER, Chamber, Arsenal spawn/damage/crit, blood, damage numbers.

Mirror is explicitly frozen; see `09`.

## Agent durability law
Arena workspaces can disappear.
Maximum unverified substantive work:
- about 5 minutes; OR
- 150-250 meaningful LOC; OR
- one coherent small slice,
whichever comes first.

Before another large slice/browser run/refactor:
diff -> smallest sanity test -> commit -> push -> verify remote SHA.
If auth/push verification fails, stop implementation immediately; preserve local work, restore remote durability, then resume.

Checkpoint is crash recovery, not a reason to ask owner whether to continue.
Continue automatically through independent slices until implementation/evidence is exhausted.
