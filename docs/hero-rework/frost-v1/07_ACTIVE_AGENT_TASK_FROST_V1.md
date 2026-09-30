# ACTIVE AGENT TASK — FROST V1

Implement FROST V1 completely from the prepared authority package.

## Start

Stay on YOUR Arena-assigned session branch and push only to that branch.

Fetch:
director/frost-v1-preload-20260930

Project baseline truth:
6b83fc6502eb8e23e4bd122074fc7fdfb47441ae

Before editing, verify:
- baseline is in preload ancestry;
- preload changes only Frost docs/reference/support tooling;
- Gold SHA matches manifest;
- your session branch is anchored to the preload tip without mutating the reference/preload branch.

This is a CLEAN implementation attempt. Rejected SHA `7b7efa298abb8e02bebbea6bced365b7b12dd29c` is negative evidence only: DO NOT cherry-pick, merge, or copy its implementation code, and do not use it as a starting tree.

Then read the entire frost-v1 package in the mandated order and audit the listed live source.

## FINAL REBUILD OVERRIDE

Read `docs/hero-rework/frost-v1/09_FINAL_GOLD_REBUILD_AUTHORITY.md` before any edit. The current implementation has already been owner-playtested and its presentation is NOT accepted. Do not merely patch the current bridge. Audit the exact canonical Gold, salvage proven gameplay truth, and rebuild/replace the presentation bridge as necessary.

Owner-observed release blockers:
- A2 ice is visually disconnected/detached and differs from Gold.
- A1/A2 can make the whole arena flicker, lose ice detail, and make the opponent repeatedly scale large/small.
- Frost's battle-scale visual is smaller than peer fighters.
- More unlisted visual defects are expected; perform a complete Gold-vs-production lifecycle audit.

The final result must be visually faithful to the canonical Gold, not merely test-green.

## Objective

Replace the obsolete product ICE rework with FROST while preserving storage/save compatibility.

FROST:
- A1 directional Frozen Floor -> battlefield firearm freeze/acquisition.
- A2 native-inertia Hunt -> actual-path ice -> real-contact Cold Shock -> exact live-holder firearm steal when Frost is unarmed.
- Passive Frozen Gun -> Frozen Bullet -> 8% Level-1 Freeze with correct blast grouping and refresh law.

Port the exact canonical Gold faithfully as presentation. Do not use the obsolete 975,616-byte Gold or any prior generated Frost Gold artifact as visual authority.

## Non-negotiable corrections

- A1 ~0.25s cast does NOT stop/brake/position-lock native locomotion;
- no generic/homing A2 steering;
- preserve original APEX heading/inertia/wall/body bounce;
- no sticky contact;
- A2 separation must clear new-contact eligibility so genuine re-contact in the same cast can proc again;
- A1 direction is movement/orientation, not enemy/weapon aim;
- A2 must query the opponent's authoritative equipment carrier; colliding body is not assumed to be holder;
- no fresh equip() for A2 steal;
- no holder state reset;
- semantic shot/blast IDs originate at the real weapon fire source and propagate to pellets;
- Freeze RNG is consumed ONLY on confirmed eligible body hit, never on projectile fire or miss;
- shotgun one Freeze roll per blast, not per pellet;
- JACKHAMMER one roll per blast;
- successful proc while already Frozen resets remaining to 0.90s;
- 0.50 reproc lock begins only after actual thaw;
- no old ice.* mechanics double-run;
- no legacy ICE overlay/audio over Frost Gold; suppress by semantic Frost source/event, never by target identity;
- no head-only/generic-geometry fake Gold port: the real A1/A2/gun/bullet/steal/freeze lifecycle must consume production Frost state/events and preserve the direct-frontal Frost identity;
- no Frost-specific SFX work;
- no Lv2-Lv5 production progression invention;
- no self-retuning of Playtest V0 numbers.

## Scope

Prefer Frost-local code.
Use minimal audited shared hooks only where the baseline lacks the semantic capability.
Do not regress/rewrite CRYSTALA V2, ROBOT, HUNTER, Chamber, Arsenal damage/crit/spawn laws, existing Gold/presentation, blood/splatter or damage-number systems.

Do not stop at analysis. Implement the final rebuild, add release-blocking presentation integrity gates, produce real-browser battle-scale evidence, audit all listed and unlisted visual failure classes, push, remote-verify, and report one final result. Do not declare completion from headless green alone.

Treat Arena local state as disposable. Follow the runbook's Git-token-expiry law: keep unverified work to roughly 5 minutes / 150–250 meaningful LOC, use `tools/frostGitDurabilityCheckpoint.mjs`, and STOP substantive coding immediately if remote auth/push/verification fails until exact local HEAD is remote-verified again.

Use 03_IMPLEMENTATION_TEST_MATRIX.md as the acceptance checklist.
