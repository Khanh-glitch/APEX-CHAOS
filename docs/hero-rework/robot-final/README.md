# APEX CHAOS — ROBOT FINAL INTEGRATION HANDOFF

Date: 2026-09-29

## Baseline

- Repository: `Khanh-glitch/APEX-CHAOS`
- Slime playable baseline selected for Robot integration: `arena/01a0e749-apex-chaos@84d386337d97ed4575a0cf476ecf05ec54321660`
- Director integration branch created from that exact SHA: `director/robot-final-integration-20260929`
- Do not start from `main`.
- Do not use `director/slime-crash-recovery-20260929@696170b...` as the gameplay tree; that HEAD is a closeout/authority-doc lineage, not the newest playable Slime tree.

## Authority split

1. `docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html` is the owner-approved ROBOT presentation authority.
2. Current APEX gameplay/runtime on the baseline is mechanics/environment authority.
3. `tools/hero-rework/source/robot-final/source-sfx/*` are the exact owner-source Robot SFX authority; `tools/hero-rework/source/robot-final/sfx/*` are pre-bridged compressed runtime copies.
4. The prototype's built-in WebAudio synth sounds are timing aids only and MUST NOT ship.

## Final SFX map

- `robot_a1_lock.wav` — successful A1 press / eligible weapon acquired.
- `robot_a1_no_weapon.mp3` — deliberate A1 press with no eligible revealed weapon; cooldown remains untouched.
- `robot_a1_dash.wav` — actual A1 dash launch.
- `robot_a2_activate.wav` — A2 activation/open/structural lock.
- `robot_a2_armor_hit.wav` — any incoming hit while A2 armor is active. Same file for all hit strengths; no heavy variant.
- `robot_a2_end.wav` — exact A2 end/close at gameplay expiry.
- `robot_passive_milestone.mp3` — a real milestone threshold crossing.
- `robot_passive_upgrade.mp3` — a real passive upgrade/refund event.

No clamp SFX. No separate A2 heavy-hit SFX. The previous `mixkit-shuffling-gear-mech-item-3152.wav` A2-open candidate is rejected and not part of the lock.

## Critical Robot gameplay laws to preserve

- A1 cooldown 10 s.
- A1 targets nearest eligible REVEALED pickup; T6/Stormbreaker is never auto-targeted.
- A1 physical dash, no teleport pickup, max dash window 0.55 s; physical contact remains pickup authority.
- No eligible A1 target: fail cue, no cooldown consumption.
- A2 cooldown 10 s; exact duration 3.0 s; incoming damage multiplier 0.45 (55% reduction); CC still applies.
- Passive counts credited realized damage only.
- Passive refund sequence is frozen: milestone 1 = 0, #2 = 0.5 s, #3 = 1.0 s, #4 = 1.5 s, then +0.5 s per later milestone.
- Production milestone thresholds remain unresolved/null. Never invent thresholds. Presentation may be tested with test-only injected thresholds but production must not activate fake milestones.

## Visual portability law

The HTML is not a vague inspiration. Preserve the Robot's silhouette, segmentation, masks, layer order, palette/materials, articulated poses, spring character, inertial lag, A1/A2 choreography, hit routing, wall response, fire recoil, passive indexing, afterimages/trail, sparks and restrained eye bloom.

Adapt only what the APEX environment requires: coordinate space, body radius/world scale, camera/DPR, real collision timing, actual weapon renderer, actual projectile/hit events, audio bus, runtime lifecycle and performance. Do not port the prototype stage/background/HUD/buttons/demo projectiles/fake gun.

See `SHA256SUMS.txt` before implementation.

## Self-contained repo law
Arena must not ask for the Robot ZIP or SFX uploads. All visual authority, exact source SFX, runtime copies, provenance, checksums, and implementation prompt are already present on `director/robot-final-integration-20260929`.
