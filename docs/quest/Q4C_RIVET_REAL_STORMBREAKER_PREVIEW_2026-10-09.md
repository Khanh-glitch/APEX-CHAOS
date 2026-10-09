# Q4C.1 — Guarded RIVET real Stormbreaker flight preview

Base: `1d32751d6b8da756beb3aae269f8394b46d19f6a`. Branch: `quest/q4c-rivet-suppression-preview-from-q4b`. This is NOT owner-approved rescue/cinematic or Quest completion.

On a real E01 safe-hold proven by R1/R2 pistol damage, J/K executor casts and both HP<=500, an explicit test/Quest-Gold-preview-only call may equip a RIVET rig holder with the actual Arsenal STORMBREAKER. Only this equipment and its normal thrown projectile are ticked. No timer, Fighter position, HP, pickup, economy, J/K or Director checkpoint may advance. One flight only; repeated calls rejected.

Rig coordinates (500,72) and target marker (500,925) are **non-canon**. The projectile has no damaging fighter collision or homing in this preview, but preserves actual Arsenal sprite, velocity, windup, ricochet, maxFlight and exit lifecycle. No fake hit, Story completion, rig artwork, blackout or dialogue. Real rescue/consequence/visual requires owner direction.

CI workflow `quest-q4c-rivet-preview.yml` runs existing Q1/Q2/Q4A/Q4B/browser/production gates plus eight full organic hold-to-true-Stormbreaker preview soaks. Confirm actual CI before calling this gate green. No production deploy or Gold global-layout edits.
