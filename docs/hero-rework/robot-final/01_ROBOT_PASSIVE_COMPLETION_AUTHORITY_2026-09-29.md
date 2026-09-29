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

Preserve current executor semantics:
- if A1 has cooldown remaining, refund A1;
- else if A2 has cooldown remaining, refund A2;
- else milestone/refund event may be visually acknowledged but no cooldown can be reduced.

This targeting law can be rebalanced later only by explicit owner approval.

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
- when a refund actually applies, show the exact slot and amount briefly, e.g.:
  - `A1 -0.5s`
  - `A2 -1.0s`
- when no cooldown can be reduced, do not claim a refund occurred.

The HUD renderer must consume authoritative passive state/events; it must not implement a second damage counter.

## Event / SFX law

Keep single-dispatch semantics:

- `RobotPassiveMilestone` — one milestone presentation/SFX per threshold crossing;
- `RobotPassiveUpgrade` — one upgrade/refund presentation/SFX when applicable;
- `MilestoneRefund` remains telemetry alias only and must not replay presentation/SFX.

## Required proof

Use real production gameplay, not manual state injection, to show:

1. before 150 cumulative damage: 0/6 and next 150;
2. crossing 150: milestone 1 visual/SFX, no cooldown refund;
3. crossing 300 while A1 has cooldown: exact 0.5s A1 reduction;
4. later milestone with A1 clear and A2 cooling down: refund A2 under existing targeting law;
5. LIVE BURST resets after 1.20s silence while ROBOT cumulative milestone progress remains;
6. match reset clears milestone progress;
7. no duplicate passive sounds/events.

This is a bounded completion of ROBOT passive. Do not reopen general Robot art or motion.
