# APEX CHAOS — HERO REWORK PHASE 1 — READ FIRST

Status: Phase 1 gameplay/system design CLOSED on 2026-09-27.
Visual direction/assets are deliberately deferred and are NOT an implementation blocker.

## Authority precedence

1. Latest explicit owner instruction after this file.
2. `01_AIL_V2_CANONICAL.md`
3. `02_LEVEL1_CANONICAL_BASELINE_V1_2.md`
4. `03_HERO_DEFINITION_CONTRACT_V1_FINAL.md`
5. `04_PHASE1_FINAL_FREEZE_AND_ROSTER_CUTOVER.md`
6. `05_IMPLEMENTATION_TASK_FINAL.md`
7. Historical handoffs / V0 briefs / old roster documents.

If history conflicts with these files, history is evidence only.

## Canonical product roster

ROBOT, CRYSTAL, MAGNET, BLACK_HOLE, MATH_V2, ICE, RUBBER, HUNTER, TIME, MIRROR, SLIME, SNIPER.

Legacy NEWBIE migrates to ROBOT.

## Phase 1 final status

- AIL v2: DONE.
- 12-Hero Level 1: DONE.
- ICE ambiguity closed: one CHILL status = 30% slow, 2.5s duration, refresh/no intensity stacking; Deep Freeze Lv1 threshold 3.0s; Freeze 1.1s.
- Independent A1/A2/Passive levels: DONE.
- Max skill level: 5.
- One progression knob per skill: HARD LAW.
- Exact Lv2-Lv5 live balance values: deferred to real-engine balance after Level-1 mechanics exist.
- Hero Definition Contract: owner-approved.
- Visual/art/VFX/audio direction: separate later phase.
- Roster cutover: canonical 12 ACTIVE_PRODUCT; old Heroes quarantine before physical deletion.

## Git preparation state

Task preparation audited branch:
`arena/01a0e086-apex-chaos`

Tip at preparation:
`8ca566b378c48cfb6b81ec17711a7c8e6e16d139`
(evidence-only)

Latest gameplay/runtime code beneath it:
`2a93825f3208c0ed27c866abcbb25720858fd671`

Safety rollback branch created before task docs:
`safety/pre-hero-rework-implementation-20260927`

ALWAYS fetch/audit live Git again before implementation because evidence/Agent commits may advance the branch.

## Operating rules

- Checkpoint commits are crash-recovery, not owner approval gates.
- Do not stop after every checkpoint asking to continue.
- Preserve local/unpushed work before reset/clean.
- CI/tests are not owner visual/feel acceptance.
- Preserve blood/splatter.
- Do not reduce combat VFX quality as a performance shortcut.
- Do not invent final Hero visual direction.
- Do not rewrite the whole engine into ECS.
- Do not let legacy target-Hero kits double-run with the rework.
