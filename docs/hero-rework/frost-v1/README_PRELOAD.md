# FROST V1 — PRELOAD PACKAGE

Status: OWNER-PREPARED IMPLEMENTATION AMMUNITION
Date: 2026-09-30
Repository: Khanh-glitch/APEX-CHAOS

This directory is the zero-chat-memory authority package for the FROST V1 implementation pass.

## Mandatory project truth

Reference branch:
arena/01a0f1e7-apex-chaos

Exact post-CRYSTALA-V2 baseline:
6b83fc6502eb8e23e4bd122074fc7fdfb47441ae

This SHA is immutable reference truth for this task. Do not push implementation commits to that branch.

A new Arena chat must remain on its Arena-assigned session branch. It may fetch this preload branch and anchor its own clean session branch forward to the preload tip, but it must push implementation commits only to the Arena-assigned session branch.

## Read order

1. 06_ONE_SHOT_RUNBOOK.md
2. 00_FROST_IMPLEMENTATION_AUTHORITY.md
3. 01_OWNER_APPROVED_GOLD_REFERENCE.html — read/run it in full
4. 02_GOLD_TO_GAME_ADAPTATION_MAP.md
5. 03_IMPLEMENTATION_TEST_MATRIX.md
6. 04_ZERO_CONTEXT_HANDOFF.md
7. 05_PRELOAD_MANIFEST.json
8. 08_PRELOAD_HOSTILE_AUDIT.md
9. 07_ACTIVE_AGENT_TASK_FROST_V1.md

Also read the baseline source files and protected-system authorities named by the runbook before editing.

## Authority precedence

1. Latest explicit owner instruction after this package.
2. 00_FROST_IMPLEMENTATION_AUTHORITY.md.
3. 01_OWNER_APPROVED_GOLD_REFERENCE.html for presentation only.
4. 02_GOLD_TO_GAME_ADAPTATION_MAP.md.
5. The exact live baseline at 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae.
6. Older ICE documents/runtime comments and historical prototypes.

Old ICE gameplay does NOT override this package.

## Gold identity

Canonical owner-approved Gold:
01_OWNER_APPROVED_GOLD_REFERENCE.html

Expected SHA-256:
59201be3d33bdfbeb8459656d3ef37caf922382a06852bd7a609472fdce2da43

The Gold is visual / asset / VFX / motion authority.
It is NOT production gameplay, input, physics, inventory, AI, balance, collision, or save authority.

The later FROST_GOLD_SIGNATURE prototype is NOT the selected Gold for this implementation. The selected authority is the Fusion file above.

## Deliberately deferred

- FROST-specific SFX: deferred. Do not source replacements or invent temporary sounds.
- Hero/skill Lv2-Lv5 progression design: deferred. Production FROST V1 is Level 1 only.
- Final balance after owner playtest: deferred. Implement the frozen Playtest V0 numbers; do not self-retune.

## Preload safety

This preload branch must contain authority/reference/support tooling only.
It must not change production gameplay/runtime files relative to 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae.

Git durability helpers:
- `tools/preflightFrostOneShot.mjs` — safe ancestry/Gold/auth preflight + optional anchor.
- `tools/frostGitDurabilityCheckpoint.mjs` — remote-auth heartbeat, session-branch push + remote SHA verification, and local recovery bundle/patch generation if remote persistence fails.

The implementation session may make the minimum narrow production changes required by the authority, with regression tests. Direct semantic rewrites of CRYSTALA, ROBOT, HUNTER, Chamber, unrelated Arsenal systems, or unrelated shared runtime are prohibited.
