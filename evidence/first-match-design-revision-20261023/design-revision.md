# First-match design revision — owner decision draft

**Status: revised static concept only — not implemented, not accepted.** No application source, gameplay, economy, balance, cooldown, target, award, or Result authority changed. The previous runtime review remains partial; this is not a new audit.

## Revised Battle A/B

| Viewport | A — unmodified live capture | B — revised static concept |
|---|---|---|
| Desktop 1440×900 | [A](ab/desktop-A-live-1440x900.png) | [B](ab/desktop-B-truthful-agency-1440x900.png) |
| Landscape mobile 844×390 | [A](ab/mobile-A-live-844x390.png) | [B](ab/mobile-B-truthful-agency-844x390.png) |

Both A captures are from the same real NEWBOT-vs-NEWBOT BOT run on build `18bc21b07d73b881dafbb732630ca6bcd1c21214`: desktop at match clock `3.729 s`, mobile at `3.828 s` (99 ms apart). B is a design composite, not a runtime screenshot or app build. Desktop B overlays only the existing left rail; the arena and fighters remain the same pixels and footprint as A. Mobile B keeps the visible mobile actors/scene, moves the coach into the P1 rail, and restores only coach-/panel-obscured arena pixels from the same run's clean desktop frame 99 ms earlier. That restoration uses no fixture or invented fighter/VFX; the mobile B arena is nevertheless a static composite, not a captured mobile implementation.

## Player-agency model supported by evidence

- In the observed BOT fight, the fighters moved, selected/acquired weapons, and attacked without any player movement, pickup, aim, or target-selection input being presented or used. Do not teach a movement key, joystick, or manual pickup action. Availability of any additional controls outside this tested flow remains **unverified**.
- The observed player input surface exposes timing Skill 1 (`J`) and Skill 2 (`K`); only a successful J cast is verified in these runs. The HUD source also routes skill-card pointer input, but physical touch-device behavior was not tested.
- **J / Weapon Dash:** `READY` is a cooldown projection, not the full castability test. Show `CASTABLE NOW` only when cooldown is clear, the canonical human `canCast` finds an eligible revealed pickup (nearest revealed pickup, excluding T6), and the input path is not blocked by a tutorial pause. A failed condition emits a fail cue and does not consume cooldown. At run06 clock `3.102 s`, while the guide said “Press J now,” P1's J press emitted `RobotA1NoWeapon`, `RobotA1NoTarget`, `CastFailCue`, and `AbilityPress(ok=false)`. A separate real attempt at `3.036 s` did cast against a live `SHOTGUN` target. These are separate moments/runs; the successful cast is not represented as the failed screenshot's outcome.
- **K / Virtual Armor:** source contract is a 10 s cooldown and a 3 s damage-reduction window (`incomingMult = 0.45`). The BOT threat heuristic is not a human cast precondition; ordinary cooldown/input gates still apply. Run06 contains a P2 BOT `RobotA2Start` and `RobotA2Hit` (17.15 incoming → 7.7175 reduced), but the one logged P1 K keypress occurred while the J lesson was paused and produced no P1 `AbilityPress`/`Cast`/cooldown/effect event. **A successful P1 K cast remains unverified.** The B card therefore describes the sourced effect, not a P1 success.
- Captured accessibility names `SNARE LINE (J)` and `MANTIS RUSH (K)` conflict with the visible `WEAPON DASH` and `VIRTUAL ARMOR`. Any implementation must align visible and accessible names without changing the underlying skills.

## What changed in B — and why it improves comprehension

1. **Two independent J states instead of one misleading READY:** show cooldown readiness separately from live target eligibility. The live design rule is `CASTABLE NOW` only when cooldown is clear **and** the canonical eligible-pickup test passes; otherwise show the exact blocking reason (for example, `NO VALID TARGET`). A failed press gets short, card-adjacent feedback (`NOT CAST · NO VALID TARGET`) while the cooldown remains ready. Do not ask the player to press J until the same castability condition passes. If a paused lesson has no eligible target, explain it and expose the existing `SKIP`/resume action.
2. **J/K show their cause → effect:** J targets a revealed weapon and dashes toward it; K creates the 3 s incoming-damage-reduction window. The artwork and existing Gold identity are retained; no new control, mechanic, or VFX is drawn.
3. **The coach is outside the arena:** B uses the P1 rail, keeps a visible Skip affordance on mobile, and replaces the impossible “run over to pick up” instruction with the observed model: fighters move/pick up automatically; the player times J/K.
4. **Combat readability is preserved:** desktop B leaves the live arena/fighter footprint unchanged (the former proposal reduced the arena from about 836 px to 740 px). Mobile B keeps the same outer arena frame and removes the guide from the playfield. P1/P2 remain recognizable and J/K are compact but individually legible.

The labels in these PNGs are proposed presentation copy/states. They are not claims that those labels, feedback, or a successful P1 cast exist in the current build. The static concepts are ENG; any approved implementation would need the existing EN/VIE localization path.

## Owner-reported Result / P90 — analysis only, no layout mock or implementation

The owner-described wide-short screenshot in [the product rejection](https://github.com/Khanh-glitch/APEX-CHAOS/pull/101#issuecomment-6356139683) is the source for this analysis: approximately `1856×831`, NEWBOT P1 defeat / P2 victory, P90 weapon damage `310`, total damage `1191 vs 1392`, awards `16 vs 19`; the owner reports that the P90 art is visually absent and the two NEWBOT portraits are tiny/inconsistently sized. The independent review also says this Result case remains **unverified**.

The original bitmap was not present in this branch's evidence folder, and the GitHub comment API body contains the written observations rather than an image attachment. I therefore have **not** independently remeasured its painted pixels, decode state, or portrait footprints. Source inspection confirms the canonical `public/assets/arsenal/weapons/c/P90.png` exists at `197×80` and is very dark on a dark background; that is a plausible contrast concern, **not a proven root cause**. Run06 ended at `21.866 s` with both fighters alive and never reached KO, Result, P90, or Continue.

**Proposal for owner review only:** if separately authorized, keep the canonical P90 and both canonical NEWBOT portraits, give equal fighters comparable painted size, and provide enough Gold/neutral contrast behind the P90 to make the existing art legible. Preserve the sealed winner/loser, damage, and awards story. This is not a Result A/B or structural layout approval; no Result change is proposed for implementation.

## Decisions needed before any source work

1. Approve/reject the B Battle hierarchy and the two-part `cooldown ready` vs `castable now / reason` model, including the short failed-press feedback.
2. Approve/reject the outside-arena coach placement and the rule that a J lesson prompts only when the canonical eligible-pickup condition is true (otherwise explain and let the player resume).
3. Confirm the visible/accessible skill-label parity and localized copy direction. No J/K mechanics or balance change is requested.
4. Keep Result protected. If a Result layout concept is wanted, explicitly authorize that separate design step first; the current P90 note is analysis only.

**Still unverified:** successful P1 K cast; real-device touch and audio behavior; a KO/Result/P90 run; pixel-level inspection of the owner Result bitmap; and Continue interaction. No full RA, Result implementation, merge, deploy, or publication was performed.
