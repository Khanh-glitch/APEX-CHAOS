# Magnet V1 — final deterministic bridge correction

Date: 2026-10-01  
Base: `c0cd478024b12b9c79560f413cbc4c96b00fd6a9`

## Scope

This is a narrow bridge correction. It does not rebuild Magnet, change the canonical donor, alter A1/A2 gameplay laws, replace projectile ownership/lifecycle, or restore a synthetic floor grid.

## Production pipeline audit and correction

The original engine draw has a background/projectile/world-effects/particle → fighter seam, but the effective shipping renderer is replaced by `apexFullRosterQa.js`. Its established order is background/projectiles/scent → fighters → top-layer particles/shockwaves. The correction therefore installs the world-deformation hook in both the original engine seam and the effective shipping seam, without moving unrelated top-layer phases.

Gold floor deformation was removed from per-fighter `drawBefore()`. The presentation adapter now enumerates Magnet combatants in stable `idx` order and invokes only `drawArenaDistortion()` from the world seam. The existing bounded `ctx.canvas` sampling and displacement-field mathematics are unchanged.

Real Chromium traces prove:

- P1: `seam → distortion:0 → canvas sample → seam end → fighter:0 → fighter:1`.
- P2: `seam → distortion:1 → canvas sample → seam end → fighter:0 → fighter:1`.
- Magnet mirror: `distortion:0` then `distortion:1`, with both samples before either fighter.
- `fighterInsideSeam` is zero in all captured frames; local copies remain bounded to at most `92 × 92` on a `1000 × 1000` canvas.

## Same-frame movement authority

`Fighter.update()` now records the actual ordinary-locomotion decision and vector at the canonical movement branch, after shell/executor lock relatching. Magnet presentation consumes that record after movement instead of guessing intent before executor processing.

The record keeps ordinary locomotion, engine push, and Magnet A2 external velocity separate. Direct production integration evidence proves:

- ROOT: body displacement and Gold donor locomotion remain zero while locked.
- Release: first donor proxy speed is `12.0833 px/s`, then ramps cleanly; no neutral snap or non-finite rig history.
- Explicit body hold: the same authoritative movement branch is locked.
- ROOT plus hostile Magnet A2: ordinary locomotion stays inactive while independent external velocity is represented (`-46.8352 px/s`) and physically displaces the rooted body.

## Contact liveness

The existing contact probe still reports one real `BodyCollision`, zero maximum penetration, and zero penetrating frames. It now waits for A2 expiry and commands both live bodies apart. Distance increases from `150` to `548.1663`; Magnet and Robot each independently move away. No contact code change was required.

## Gates

Passing Magnet evidence:

- gameplay `27/27`
- presentation `13/13`
- scheduler, motion trace, semantic/scale/socket, canonical donor parity, motion-authority ROOT/hold/A2 integration
- real Chromium `21/21`, including actual PISTOL `aq_bullet`, P1/P2/mirror layer provenance, locomotion/reverse/stop/wall, A1 positive control, contact separation/liveness, and no browser runtime errors
- runtime lock: `20261001-magnet-v1-r5`, 38 versioned runtimes
- production build

Protected suites passing unchanged: Robot gameplay `11/11`, Robot recoil `6/6`, Crystala Gold `25/25`, all four Slime suites (`9/9`, `5/5`, `6/6`, `7/7`), and locomotion `4/4`.

Two pre-existing protected-suite assertions are not green and were not weakened or “fixed” outside scope:

- Robot presentation is `18/28`; an exact run from base commit `c0cd478` produces the same failures.
- Crystala gameplay is `72/73`; G07 expects an obsolete `arsenalQuestRuntime.js` hash (`c820…`), while both base `c0cd478` and this correction have the same unmodified file hash (`59366d…`).

Canonical evidence: `evidence/canonical-gold-parity.json`  
Chromium evidence: `evidence/corrected-real-browser.json`

Automated evidence is not owner visual acceptance.
