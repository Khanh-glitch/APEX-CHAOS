# APEX CHAOS — Battle Trigger + Responsive Relock Audit

Date: 2026-10-04
Branch: `arena/01a1025a-apex-chaos`
Audited starting HEAD: `19bddc0abe8a2aa88d0000138d85ef3890247350`
Runtime baseline before implementation remains: `20261003-mirror-v1-r42`

## Donor forensic result

`docs/gold-ui/current/donors/battle-hud/index.html` is intentionally dual-purpose:
1. Gold presentation donor.
2. isolated LAB/simulator.

Presentation is authority. Simulator truth is not.

Non-production donor harness identified:
- fake state `S` / `G`;
- `applyDamage`, `heal`, `cast`, `skillEffect`, `swapWeapon`;
- fake reload / KO / round / timer / BOT / regen;
- H/C/D/F/W/E/R/T/P/L/V;
- M mode toggle;
- U/I P2 skills;
- preset whole-stage scaler;
- LAB/diagnostic/timer-open controls.

## Production seams confirmed

- `Fighter.takeDamage` already emits post-mitigation realized damage through `APEX_COMBAT_HUD.onRealizedDamage`.
- `Fighter.heal` owns real heal math but lacks a parallel realized-heal HUD observer.
- `APEX_COMBAT_HUD.projection()`, `syncVitals()`, `APEX_ARSENAL.hudProjectionFor()`, and `resultProjection()` remain current read-model authority.
- hero rework currently implements P1 J/K and P2 cast AI.
- owner Local 2P P2 Digit1/Digit2 input is not yet implemented.
- BOT/LOCAL profile exists in Arsenal state; product handoff must prove it is set from the real picker and controls P2 AI.

## Owner corrections recovered from prior Gold decision pass

- Heavy = >200 realized damage to the same victim within rolling 1.20s; one Heavy response per qualifying burst.
- Stormbreaker confirmed damaging hit = Heavy + separate Thunder/Lightning.
- Critical full presentation family uses attacker/source identity accent, not donor fixed orange.
- P1 = J/A1, K/A2.
- Local P2 = 1/A1, 2/A2.
- BOT = P1 controls only; P2 real CPU.
- mobile human skill cards are touch controls.
- low-HP / tension phase: both active combatants <=500 HP.
- fake H/C/D/F/W/E and LAB controls do not ship.

## Responsive authority

Shipping responsive behavior is re-composition:
- desk;
- mobile landscape;
- mobile portrait.

The donor preview transform scaler is diagnostic only.

Reference proof:
- 1366×768
- 1920×1080
- 844×390 safe [0,44,16,44]
- 390×844 safe [47,0,34,0]

Local portrait 2P rotates only P2 control territory 180°.
Arena, timer, neutral match information and global FX remain upright.

This audit changes documentation/implementation authority only. It does not change gameplay or runtime bytes.
