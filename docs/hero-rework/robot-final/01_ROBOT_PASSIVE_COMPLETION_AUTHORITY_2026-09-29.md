# ROBOT PASSIVE COMPLETION AUTHORITY — 2026-09-29

Status: OWNER-APPROVED COMPLETION PASS.

This document resolves the only known production blocker in ROBOT passive and defines the HUD feedback needed to make it perceptible in normal play.

## Baseline to preserve

Do not reopen accepted ROBOT visual/motion work from:
- `15bd30da00960ff9d563b544d916df626a075e2e`
- subsequent Hunter gameplay-checkpoint documentation and bot-only evidence refresh commits must not alter the accepted Robot product behavior.

Preserve:
- fixed world-facing chassis;
- A1 lock/wind-up/dash/contact authority;
- real weapon socket;
- A2 armor behavior and directional hit response;
- approved eight-SFX contract;
- Robot blood isolation;
- mask cleanup from the visual diagnostic;
- one AudioContext.

## Root cause resolved

Production currently uses:
`milestoneThresholds: null`

Therefore `robot.damage_milestones` only records cumulative credited realized damage and never fires production refunds.

The refund executor itself is already proven in deterministic tests.

## Production milestone law

Use cumulative CREDITED REALIZED damage dealt by ROBOT.

For the current 1000 HP match:

`150 / 300 / 450 / 600 / 750 / 900`

General design relationship:
- milestone spacing corresponds to 15% of the authoritative target max HP at match start;
- current shipping match HP is 1000, therefore exact production thresholds above are authoritative for this pass.

Do not make this a rolling burst threshold.
Do not reset milestones after combat silence.
Reset only with match/reset lifecycle.

## Refund sequence

Keep the existing owner-approved ladder:

- milestone 1: 0.0s
- milestone 2: 0.5s
- milestone 3: 1.0s
- milestone 4: 1.5s
- milestone 5: 2.0s
- milestone 6: 2.5s

Do NOT introduce a new refund-targeting priority in this pass.

Preserve current targeting semantics:
- if A1 has cooldown remaining, target A1;
- else if A2 has cooldown remaining, target A2;
- else no cooldown can be reduced.

This targeting law can be rebalanced later only by explicit owner approval.

### Truthful applied-refund law

The configured ladder value is the REQUESTED refund, not automatically the amount actually removed.

For an actual target:
- capture cooldown remaining immediately before the refund;
- apply the existing clamp-to-zero refund;
- compute `appliedRefund = before - after`;
- authoritative upgrade/HUD feedback must report `appliedRefund`, not a larger nominal ladder value.

Example:
- requested refund = 0.5s;
- A1 has only 0.2s remaining;
- A1 reaches 0;
- truthful feedback = `A1 -0.2s`, not `A1 -0.5s`.

If neither A1 nor A2 has cooldown remaining:
- the milestone still counts and receives milestone feedback;
- do NOT emit/claim an actual cooldown upgrade/refund;
- do NOT play the upgrade/refund SFX as though cooldown changed.

This is a truthfulness correction, not a balance change.

## HUD integration authority

Reuse the existing universal combat HUD:
`public/game/ui/apexCombatHudRuntime.js`

The existing LIVE BURST / PRESSURE system remains unchanged:
- positive realized damage only;
- burst total persists while hits continue;
- reset only after 1.20s silence;
- CONTACT / PRESSURE / RAMPAGE / OVERDRIVE / CRITICAL RUSH / MOMENTUM SWING / DEVASTATING remain exactly as today.

ROBOT milestone progress is a separate persistent layer inside the existing ROBOT side panel. Do NOT create a second standalone HUD.

Required ROBOT-only passive read:

- persistent progress toward the next milestone;
- six-segment milestone rail or equivalent compact representation;
- current reached count;
- next threshold when one remains;
- on milestone crossing, reuse the existing panel heat/punch visual language rather than inventing an unrelated dashboard style;
- milestone #1 clearly registers visually even though refund = 0;
- when a refund actually applies, show the exact slot and ACTUAL APPLIED reduction briefly, e.g.:
  - `A1 -0.5s`
  - `A2 -1.0s`
- if clamp-to-zero means less than the nominal ladder value was removed, display only the real removed amount;
- when no cooldown can be reduced, do not claim a refund occurred and do not fire upgrade/refund presentation.

The HUD renderer must consume authoritative passive state/events; it must not implement a second damage counter.

## Event / SFX law

Keep single-dispatch semantics:

- `RobotPassiveMilestone` — one milestone presentation/SFX per threshold crossing;
- `RobotPassiveUpgrade` — one upgrade/refund presentation/SFX only when cooldown was actually reduced; its payload must expose the actual applied reduction;
- `MilestoneRefund` remains telemetry alias only and must not replay presentation/SFX.

## Required proof

Use real production gameplay, not manual state injection, to show:

1. before 150 cumulative damage: 0/6 and next 150;
2. crossing 150: milestone 1 visual/SFX, no cooldown refund;
3. crossing 300 while A1 has cooldown: exact 0.5s A1 reduction;
4. a milestone where the selected skill has less cooldown remaining than the nominal refund: HUD/event reports only the actual removed amount;
5. later milestone with A1 clear and A2 cooling down: refund A2 under existing targeting law;
6. a milestone with both skills READY: milestone advances, but no fake upgrade/refund feedback or upgrade SFX;
7. LIVE BURST resets after 1.20s silence while ROBOT cumulative milestone progress remains;
8. match reset clears milestone progress;
9. no duplicate passive sounds/events.

This is a bounded completion of ROBOT passive. Do not reopen general Robot art or motion.
