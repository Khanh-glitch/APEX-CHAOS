# HUNTER V1.1 GAMEPLAY CHECKPOINT — 2026-09-29

Status: OWNER-APPROVED GAMEPLAY DIRECTION — integration pending.

This checkpoint supersedes the previous Hunter V0 numbers/behavior wherever they conflict.

## A1 — SNARE TRAP

Intent: make trap play easier to use without making each individual trap overly oppressive.

- max charges: 3
- starting charges: 3
- recharge: 6.5s per charge
- recharge is sequential
- max active traps: 3
- placed at Hunter's current position
- trap radius: 46
- lifetime: 6.0s
- root duration on valid opponent body trigger: 1.25s
- bullets / pickups / decorative VFX do not trigger traps

Expected charge flow:
3/3 -> 2/3 -> 1/3 -> 0/3, then +1 charge every 6.5s until full.

## A2 — POUNCE + WEAK

Intent: change Pounce from a brittle one-vector skill shot into a reliable predator chase.

- cooldown: 12s
- wind-up / coil: 0.16s
- movement speed target: ~2200 px/s
- max chase duration: 0.50s
- continuously steer/re-target toward the current opponent position during the chase
- physical movement only; never teleport
- use swept body-contact authority so high-speed traversal cannot tunnel through a valid target
- normal target movement should be meaningfully chaseable rather than causing an immediate miss
- direct damage: 0
- successful body contact applies WEAK
- WEAK duration: 3.0s
- WEAK incoming damage multiplier: 1.25 (+25%)
- exceptional relocation/escape can still cause a miss

## PASSIVE — KILLER INSTINCT

Synergy law remains:
- enabled while Hunter's opponent/prey is Trapped OR Weak
- eligible incoming projectile on a genuine collision course may trigger a physical dodge
- no invisibility
- no post-dodge invulnerability
- T6 excluded
- dodge distance: 95px
- anti-chain lockout: 0.45s

Balance adjustment:
- dodge chance: 24% (was 28%)

Reason:
A1 now has three charges and A2 becomes much more reliable, so prey-debuff uptime increases substantially. The passive chance is reduced slightly to keep total defensive uptime controlled while preserving the easier, more readable Hunter flow.

## Design flow

SET TERRITORY -> COIL -> CHASE -> TRAP/WEAK -> KILLER INSTINCT WINDOW

The usability goal is easier execution, not a raw-power increase across every part of the kit.

## Integration law

When the final Hunter VFX/motion gold package is integrated, this V1.1 gameplay checkpoint and the gold presentation authority must be treated as one combined contract. Do not port the final visual package onto the old V0 Pounce/trap behavior and then retrofit gameplay afterward.
