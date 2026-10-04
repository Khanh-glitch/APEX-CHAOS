# APEX CHAOS — Result / Post-Match Gold Extension Authority

Status: SEMANTIC EXTENSION LOCKED.

**Visual precedence:** the existing Wave 1 Gold Battle HUD/KO/result/fracture source remains visual authority.

This document must not be used to create a competing generic Result screen.

## Core law

Result is the final phase of Battle, not a separate route/page.

Flow:
terminal hit
-> outcome truth locked
-> Gold KO/fracture choreography
-> settle
-> result information
-> actions.

KO is the climax. Result is aftermath.

## Mode language

BOT:
- P1 win -> VICTORY
- P1 loss -> DEFEAT

Local 1v1:
- P1 WINS
- P2 WINS

Do not use generic DEFEAT for the losing side of a shared-device Local match.

## Winner truth

Result authority must preserve:
- winnerSide: P1/P2;
- winner fighter identity;
- battle mode.

Never derive winner side by fighter name because same-fighter matchups are legal.

A runtime projection that only returns fighter name is insufficient.

## Reward

Current local product authority presently awards:
- P1 win: +50 AC;
- P1 loss: +25 AC.

Visual source must **not hardcode these rules**.

Bind canonical per-match reward projection.

Reward settlement is a separate authority from combat outcome.

Do not award currency from Result mount/render.

A result can remain valid while reward state is SYNCING/PENDING in future cloud architecture.

## Actions

Only:
- REMATCH;
- CHANGE FIGHTERS;
- HOME.

No Share/Leaderboard/Replay/Stats until real systems exist.

## Rematch

Rematch means a fresh match instance with the same setup.

Preserve:
- mode;
- selected fighters;
- valid arena/config;
- device settings.

Reset all transient combat state and one-award state.

Do not flash through Pick.

## Change Fighters

Return to the same mode's Pick with prior legal selections retained.

## Home

Return directly to Home visually.

## Arena continuity

Keep the ended arena visible behind/inside Gold result choreography when the accepted Gold source does so.

Do not replace it with a generic winner portrait page.

## Assets

Prefer zero new Result-specific character art.

Reuse Battle avatar/identity/side-color/chassis.

## Audio

Battle -> Result: theme remains suppressed.
Result -> Rematch: remains suppressed.
Result -> Pick/Home: resume preserved theme playhead according to global audio authority.

## Performance

Do not create/decode a large Result scene at the KO frame.

Keep expensive Gold result/crack layers persistent/preloaded where practical.

## Open design item

Simultaneous KO/tie semantics are not decided by this document. Do not silently invent DRAW or P2 tie-break behavior in presentation.
