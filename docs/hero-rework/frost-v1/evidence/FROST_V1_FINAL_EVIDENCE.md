# FROST V1 — FINAL WHOLE-SCREEN VISUAL EVIDENCE

Generated: 2026-10-01T03:11:52.841Z

Renderer: real APEX runtimes on a native 2D canvas (1000x1000) — the same
draw code the browser runs. Every frame of every scenario is inspected, not
a lucky frame.

Every scenario is run THREE times with identical inputs: two CONTROL legs
(same match, positions, weapons, timing — no Frost ability pressed) and the
Frost leg. The two controls measure the peer's own run-to-run variance, so
the Frost leg is judged against MEASURED noise (`ctl drift`), never against
an assumption that the scene stands still or a guessed threshold.

- **quiet breaks** — bitwise hashes of arena regions both CONTROL legs kept
  perfectly stable; with Frost on they must still be bitwise identical every
  frame. Camera drift, transform/alpha leaks, full-screen overdraw break this.
- **opp box / ctl box** — the opponent's solid silhouette (median size and the
  total size spread over the scenario) with Frost on vs the control leg.
- **same-match delta** — the decisive scale test: the opponent's box DURING the
  Frost ability minus its box in the same match before the ability, against a
  tolerance measured from the control legs (peers spawn with their own rig
  seeds, so cross-run medians measure the peer, not Frost).
  `[overlap]` marks scenarios where Frost ice intentionally covers the target
  (body contact, Freeze shell, gun steal), so the delta is informational.
- **scene ink** — whole-canvas ink sampled in six full-width bands.
- **leaks** — the presentation's canvas-state guard counter for this scenario.

| scenario | opponent | quiet breaks | opp box (spread) | same-match delta | ctl box (spread) | scene ink | leaks | verdict |
|---|---|---|---|---|---|---|---|---|
| 01-idle-vs-ROBOT | ROBOT | 0/3 | 146x140 (0/0) | 0/0 (tol 3/3) | 146x140 (0/0) | 7336..7345 | 0 | PASS |
| 01-idle-vs-ICE | ICE | 0/3 | 147x185 (1/2) | 1/0 (tol 3/3) | 147x185 (1/2) | 7346..7357 | 0 | PASS |
| 01-idle-vs-HUNTER | HUNTER | 0/3 | 156x151 (3/7) | -3/-5 (tol 4/6) | 156x151 (3/7) | 7393..7418 | 0 | PASS |
| 01-idle-vs-CRYSTAL | CRYSTAL | 0/2 | 175x171 (31/30) | 15/1 (tol 16/3) | 175x171 (31/30) | 7242..7454 | 0 | PASS |
| 01-idle-vs-SLIME | SLIME | 0/3 | 151x151 (0/0) | 0/0 (tol 3/3) | 148x151 (0/0) | 7389..7398 | 0 | PASS |
| 02-a1-vs-ROBOT | ROBOT | 0/3 | 146x140 (1/0) | 0/0 (tol 3/3) | 146x140 (0/0) | 7337..7734 | 0 | PASS |
| 02-a1-vs-ICE | ICE | 0/3 | 147x186 (1/2) | 1/1 (tol 3/3) | 147x186 (1/2) | 7351..7753 | 0 | PASS |
| 02-a1-vs-HUNTER | HUNTER | 0/3 | 156x149 (4/8) | -3/-7 (tol 4/8) | 156x149 (4/8) | 7406..7783 | 0 | PASS |
| 02-a1-vs-CRYSTAL | CRYSTAL | 0/2 | 180x170 (31/30) | 20/0 (tol 21/3) | 180x170 (31/30) | 7256..7727 | 0 | PASS |
| 02-a1-vs-SLIME | SLIME | 0/3 | 148x150 (0/0) | 0/0 (tol 3/3) | 151x150 (0/0) | 7398..7792 | 0 | PASS |
| 03-a2-vs-ROBOT | ROBOT | 0/3 | 146x140 (0/0) | 0/0 (tol 3/3) | 146x140 (0/0) | 7386..7770 | 0 | PASS |
| 03-a2-vs-ICE | ICE | 0/3 | 147x186 (0/2) | 0/2 (tol 3/3) | 147x186 (0/2) | 7340..7720 | 0 | PASS |
| 03-a2-vs-HUNTER | HUNTER | 0/3 | 155x148 (1/1) | -1/-1 (tol 3/3) | 155x148 (1/1) | 7371..7759 | 0 | PASS |
| 03-a2-vs-CRYSTAL | CRYSTAL | 0/2 | 180x170 (26/30) | 20/-6 (tol 21/7) | 180x170 (26/30) | 7364..7836 | 0 | PASS |
| 03-a2-vs-SLIME | SLIME | 0/3 | 148x142 (0/0) | 0/0 (tol 3/3) | 150x147 (0/0) | 7436..7807 | 0 | PASS |
| 04-both-moving | ROBOT | 0/2 | 146x140 (2/1) | 1/0 (tol 3/3) | 146x140 (1/1) | 6994..7209 | 0 | PASS |
| 05-a2-wall-bounce | ROBOT | 0/2 | 146x140 (1/1) | 1/0 (tol 3/3) | 146x140 (1/1) | 7019..7634 | 0 | PASS |
| 06-a2-body-contact | ROBOT | 0/2 | 177x140 (32/1) [overlap] | 32/0 (tol 29/3) | 173x140 (28/0) | 6936..7248 | 0 | PASS |
| 07-concurrent-a1-a2 | ROBOT | 0/2 | 146x140 (0/1) | 0/0 (tol 3/3) | 146x140 (0/1) | 7379..8176 | 0 | PASS |
| 08-frozen-gun-bullet | ROBOT | 0/2 | 146x140 (0/0) | 0/0 (tol 3/3) | 146x140 (0/0) | 7515..7904 | 0 | PASS |
| 09-freeze-shell | ROBOT | 0/0 | 195x191 (47/57) [overlap] | 47/54 (tol 3/3) | 157x140 (55/32) | 7133..7289 | 0 | PASS |
| 10-thaw-complete | ROBOT | 0/— | — | — | — | 7208..7308 | 0 | PASS |
| 11-a2-gun-steal | ROBOT | 0/0 | 176x168 (57/62) [overlap] | 32/29 (tol 27/34) | 170x172 (30/35) | 7061..17960 | 0 | PASS |
| 12-cast-then-rematch | ROBOT | 0/3 | 144x139 (0/0) | 0/0 (tol 3/5) | 144x139 (1/0) | 7336..7614 | 0 | PASS |
| 13-rematch-fresh | ROBOT | 0/— | — | — | — | 7230..7230 | 0 | PASS |

Frames: `docs/hero-rework/frost-v1/evidence/frames/` (one full game-canvas PNG per scenario).

**ALL SCENARIOS PASS.**

## Limitation

No Chrome/Chromium binary and no package-download network access exist in
this environment, so an automated *browser* capture could not be produced
here. This evidence drives the identical renderer code path against a native
canvas backend; owner sign-off still requires the live-preview playtest.