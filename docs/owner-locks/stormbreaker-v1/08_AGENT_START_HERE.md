# STORMBREAKER V1 — ARENA AGENT START HERE

## Authorized working branch

Work only in:

`arena/stormbreaker-red-tier`

This branch was created from the current production source:

`playtest/arsenal@430ac5269031d5b72938df16427d16bb55743155`

Do not implement this task in a second repository and do not promote to production without owner approval.

## Read these authorities in full before editing

1. `docs/agent-authority/VIBECODE_SKILL.md`
2. `docs/agent-authority/APEX_CHAOS_ZERO_CONTEXT_HANDOFF_2026-09-26.md`
3. `docs/owner-locks/stormbreaker-v1/07_OWNER_OVERRIDE_CURRENT.md`
4. `docs/owner-locks/stormbreaker-v1/00_READ_FIRST.md`
5. `docs/owner-locks/stormbreaker-v1/02_APPROVED_EXECUTABLE_REFERENCE_V9_NO_LONG_TAIL.html`
6. `docs/owner-locks/stormbreaker-v1/03_STORMBREAKER_VISUAL_GAMEPLAY_SPEC.md`
7. `docs/owner-locks/stormbreaker-v1/04_APEX_INTEGRATION_MAPPING.md`
8. `docs/owner-locks/stormbreaker-v1/05_ARENA_AGENT_IMPLEMENT_PROMPT.md`
9. `docs/owner-locks/stormbreaker-v1/06_OWNER_PLAYTEST_CHECKLIST.md`

Approved art is already in this repository at:

`docs/owner-locks/stormbreaker-v1/01_STORMBREAKER_APPROVED_ASSET.png`

## Current owner instruction — critical

The **effect / presentation / game-feel** is the highest preservation target.

Treat the approved V9 executable as the visual authority. Preserve its Stormbreaker identity exactly and improve it only where the live APEX integration can look better without changing the approved read.

Especially preserve:

- dense but hierarchical floor lightning while unclaimed;
- linked electricity across the weapon;
- charged arena atmosphere and controlled shake;
- fast spinning throw;
- lightweight rotational ghosts;
- short local electricity distributed across the whole weapon;
- **NO LONG LIGHTNING TAIL**;
- white/cyan contact flash;
- immediate disappearance of the weapon through/after impact flash;
- arena-wide impact discharge;
- brief residual victim crackle;
- fixed-cost / smooth performance philosophy.

Do not downgrade this into generic sparks or a generic weapon effect.

## Gameplay / balance values

The prototype/demo is **not numeric balance authority**.

Audit the live APEX game and choose values that fit the current weapon/rarity/combat systems for:

- damage;
- red-tier / Stormbreaker spawn probability;
- stun duration;
- global slow strength;
- attack timing/cooldown where applicable;
- consumption/lifecycle values;
- any other numeric balance value not explicitly frozen by current project authority.

The owner expects the Agent to understand the current game and make these integration/balance choices from the live architecture.

Locked gameplay concepts remain:

- Stormbreaker is the first red-tier / rarest fantasy weapon;
- both living fighters are continuously slowed while Stormbreaker remains spawned and unclaimed;
- the slow ends immediately when it leaves the unclaimed floor state;
- confirmed hit causes a real stun through the real status system;
- miss paths do not fake stun or fake impact detonation.

## Implementation standard

This is a full production integration, not a standalone demo.

Audit the real current paths for rarity, spawn, pickup, attack, thrown weapon/projectile lifecycle, hit resolution, status effects, movement modifiers, renderer, camera feedback, SFX and performance telemetry before choosing hooks.

Preserve all accepted existing production behavior unless this Stormbreaker task explicitly requires a narrow extension.

The owner should be able to directly playtest the complete Stormbreaker experience when you finish.
