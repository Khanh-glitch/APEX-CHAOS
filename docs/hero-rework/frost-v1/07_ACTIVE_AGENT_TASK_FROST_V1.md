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

Then read the entire frost-v1 package in the mandated order and audit the listed live source.

## Objective

Replace the obsolete product ICE rework with FROST while preserving storage/save compatibility.

FROST:
- A1 directional Frozen Floor -> battlefield firearm freeze/acquisition.
- A2 native-inertia Hunt -> actual-path ice -> real-contact Cold Shock -> exact live-holder firearm steal when Frost is unarmed.
- Passive Frozen Gun -> Frozen Bullet -> 8% Level-1 Freeze with correct blast grouping and refresh law.

Port the selected Fusion Gold faithfully as presentation.

## Non-negotiable corrections

- A1 ~0.25s cast does NOT stop/brake/position-lock native locomotion;
- no generic/homing A2 steering;
- preserve original APEX heading/inertia/wall/body bounce;
- no sticky contact;
- A1 direction is movement/orientation, not enemy/weapon aim;
- no fresh equip() for A2 steal;
- no holder state reset;
- shotgun one Freeze roll per blast, not per pellet;
- JACKHAMMER one roll per blast;
- successful proc while already Frozen resets remaining to 0.90s;
- 0.50 reproc lock begins only after actual thaw;
- no old ice.* mechanics double-run;
- no legacy ICE overlay/audio over Frost Gold;
- no Frost-specific SFX work;
- no Lv2-Lv5 production progression invention;
- no self-retuning of Playtest V0 numbers.

## Scope

Prefer Frost-local code.
Use minimal audited shared hooks only where the baseline lacks the semantic capability.
Do not regress/rewrite CRYSTALA V2, ROBOT, HUNTER, Chamber, Arsenal damage/crit/spawn laws, existing Gold/presentation, blood/splatter or damage-number systems.

Do not stop at analysis. Implement, test, produce browser/parity evidence where environment permits, audit, push, and report one final result.

Treat Arena local state as disposable. Follow the runbook's Git-token-expiry law: keep unverified work to roughly 5 minutes / 150–250 meaningful LOC, use `tools/frostGitDurabilityCheckpoint.mjs`, and STOP substantive coding immediately if remote auth/push/verification fails until exact local HEAD is remote-verified again.

Use 03_IMPLEMENTATION_TEST_MATRIX.md as the acceptance checklist.
