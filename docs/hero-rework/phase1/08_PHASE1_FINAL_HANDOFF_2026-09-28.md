# HERO REWORK PHASE 1 — ZERO-CONTEXT FINAL HANDOFF

Date: 2026-09-28

## Read first

This document is the post-campaign handoff for Hero Rework Phase 1.

Implementation branch:
`arena/01a0e086-apex-chaos`

Frozen safety snapshot:
`safety/hero-rework-phase1-final-20260928`

Frozen snapshot SHA:
`2e186bde42af1e941ff814b28d9c57b5066be292`

Substantive final gameplay/test SHA:
`373a218e92a12698fd5c4307c79a1da093a26259`

Do not reinterpret Phase 1 from old conversations. Read these authorities in order:
1. `00_READ_FIRST.md`
2. `01_AIL_V2_CANONICAL.md`
3. `02_LEVEL1_CANONICAL_BASELINE_V1_2.md`
4. `03_HERO_DEFINITION_CONTRACT_V1_FINAL.md`
5. `04_PHASE1_FINAL_FREEZE_AND_ROSTER_CUTOVER.md`
6. `05_IMPLEMENTATION_TASK_FINAL.md`
7. `06_POSTFREEZE_ROSTER_CORRECTION.md`
8. `07_CP-HR7_LEGACY_LOAD_AUDIT.md`
9. this handoff

## Phase 1 status

Phase 1 implementation and system validation are complete.

Validated:
- Headless suite: 334/334
- Hero Rework smoke: 15/15
- Hero Rework goldens: 11/11
- Real Chromium browser suite: 217/217
- Production build: green
- GitHub CI: green

Phase 1 is NOT owner-accepted for:
- final Hero art
- final Hero VFX
- final audio feel
- final balance / Lv2-Lv5 curves
- ROBOT milestone thresholds
- natural KO pacing
- overall feel/readability

Those belong to the next owner-facing visual/feel/balance phase.

## Canonical playable roster — exactly 12

ROBOT
CRYSTAL
MAGNET
BLACK_HOLE
MATH_V2
ICE
RUBBER
HUNTER
TIME
MIRROR
SLIME
SNIPER

NEWBIE migrates idempotently to ROBOT.

Only these 12 may appear in playable select/shop/draw/free-pick/progression/random playable pools.

## Quest encounter roster

The existing 20-stage ladder is preserved.

Canonical playable bosses use the reworked Hero runtime:
ICE, HUNTER, CRYSTAL, MAGNET, BLACK_HOLE, TIME.

The remaining boss identities remain encounter-only legacy-compatible runtimes.

Do not remap the 20-stage ladder to the 12 playable roster.

## Critical laws

- AIL v2 is the semantic adaptation layer, not an ECS rewrite.
- Ability activation goes through AbilityController.
- No raw gameplay setTimeout.
- StatusResolver is shared.
- Damage realizes through the shared pipeline.
- T6 / STORMBREAKER is immune to Hero object manipulation.
- Victim-side mitigation still applies to T6 hits.
- Stormbreaker confirmed hit authority remains 446.
- SLIME children remain outside global `fighters[]`.
- SLIME HP is distributed per body with conserved living HP.
- TIME replay is match-scoped and scheduler teardown must prevent cross-match leakage.
- MIRROR portal exit is neutral and grants no Hero damage credit.
- CRYSTAL reflection preserves projectile payload/provenance and flips controller to CRYSTAL.
- BLACK_HOLE released projectiles must not instantly re-store into the same singularity.
- Blood/splatter and CP7 menu/audio/readiness behavior must be preserved.

## Final campaign checkpoints

CP-HR5:
Cross-Hero hardening, 11/11 goldens, invariants, seeded fuzz.

CP-HR6:
All 20 Quest stages resolve through the production path. Canonical bosses use rework mechanics; boss-only identities stay encounter-only.

CP-HR7:
Legacy-load audit concluded that encounter runtimes are still load-bearing. No destructive runtime removal was justified. Performance measurement was recorded without fabricating an improvement.

CP-HR8:
Headless, smoke, goldens, real-browser, production build and CI all green.

## Safe remote milestones

`ef6ffd6` — CP-HR5 recovery fixes + goldens harness
`9f6a152` — CP-HR5 goldens 11/11 + evidence
`29b5388` — storm-b8 test isolation after NEWBIE→ROBOT cutover
`64ecc46` — CP-HR6 Quest stage resolution gates
`be8991d` — real-browser cutover corrections, 217/217
`f8b5197` — CP-HR7 load audit + measurement
`373a218` — smoke teardown lifecycle fix
`2e186bd` — final bot evidence refresh / frozen snapshot

## Arena operating rule

Arena workspaces are ephemeral.

Never keep more than one solved substantive issue unpushed.

Required cadence:
change → targeted proof → commit → fetch/reconcile bot → push → continue.

Never force-push.

Before any new Arena task:
- fetch live remote
- verify branch + SHA
- read the authority docs
- treat local workspace as disposable

## Next phase

Next work is owner-facing:
- Hero visual identity
- animation
- VFX
- readability / telegraphs
- audio
- feel
- balance
- progression values

Do not reopen Phase 1 architecture unless a real regression proves it necessary.
