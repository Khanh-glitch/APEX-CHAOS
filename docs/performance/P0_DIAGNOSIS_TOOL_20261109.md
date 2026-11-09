# P0 diagnosis tool — what it took to make it fire

Baseline under test (frozen, untouched): tag `p0-baseline-44ba89c`
= `44ba89c1f0d36422c1b08412dfeeb66863662a1c`.

The tool's first end-to-end run produced five arms, a POSTed report, and
`valid=false` on every one of them with `skillCount 0`. That was the tool being
honest about a run where nothing had happened. Five separate faults had to be
fixed before the numbers meant anything.

## 1. The match never started (four faults, in the order they were hit)

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | `waiting for boot button` forever | `#apex-boot-start` does not exist at every viewport / first-run state | wait for the stage to become interactive; click whatever is in the way |
| 2 | `onBattleLive returned false` both ways | bridge switches on literal `'BOT'`, then `onBattleLive` re-lowercases its argument, so `mode==='BOT'` is false and the BOT-opponent override replaced the requested `p2` | enter through `LOCAL`, which pairs exactly what it is told, and report the return value instead of assuming it |
| 3 | same, with no warning at all | a fresh browser profile owns only `ROBOT`/`HUNTER`; `APEX_GOLD_LOCKED -> meta.canPublicSelect` refuses CRYSTALA **and** FROST, so the bridge exits before any match exists | run on a read-only copy of the owner's own profile; report `LOCKED` rather than seeding unlocks behind the owner's back |
| 4 | arms ended `timeout` with 4–24 frames | frame-counted arms cannot finish on a slow rasteriser (1.3 s/frame here) | arms end on time with a frame floor; warmup ends on time; a watchdog ends an arm whose rAF never returns |

Also found: **BOT mode cannot produce CRYSTALA vs FROST on this build.**
`setBotOpponentId` accepts `ROBOT`/`HUNTER` and refuses `ICE`, and in BOT mode
the product picks the opponent itself, ignoring `cfg.p2`. The required pairing
is reached through `LOCAL`, and the refusal is recorded in the report.

## 2. Two arms were switched off at the wrong layer

With a real match running, the proofs caught exactly the silent substitution
they exist for:

* `noIce` patched `IceField.render` — 18 calls intercepted, **18 ice composites
  still happened**. `IceField` is the gold material sampler; the per-frame cost
  is the offscreen composite in `drawIceComposite`, whose only entry point is
  `APEX_FROST_PRESENTATION.renderSurfaceUnderWeapons`.
* `noBloom` patched `createBloomSystem` — 0 intercepted, 16 passes still ran.
  The per-match runtime already existed; bloom passes are counted inside the
  CRYSTALA presentation runtime.

Both arms now target the real entry point and prove two facts each: the entry
point was called (the arm is live) **and** the effect stopped (the frame is
cheaper for the claimed reason).

## 3. The verdict was overclaiming

A 13.4 % p95 delta was being reported as `subsystem-identified` while the two
control passes disagreed by 9.7 %. The control spread is the machine's noise
floor, so a delta must now clear **twice the measured control spread and 10 %**
before any subsystem is named. A sample under 20 frames per arm reports
`sample-too-thin-to-conclude`. Other verdicts: `control-unstable-repeat-the-run`,
`no-subsystem-explains-the-stutter`.

## 4. Self-test result (sandbox, headless SwiftShader) — instrument only

Five of five arms run and report `valid=true`; both controls prove ice **and**
bloom appeared; `noIce` reaches 0 ice composites and 0 ice render marks;
`noBloom` reaches 0 passes. The verdict is `sample-too-thin-to-conclude`
(11–16 frames per arm), which is the correct answer here: this sandbox renders
about one frame per second, so its frame numbers are **not** evidence about the
owner's machine and are not reported as such.

## 5. Package

`tools/p0diag/dist/APEX-CHAOS-P0-Diagnosis-44ba89c.zip` (99,461,990 bytes)

* game built from the frozen tag in a throwaway worktree — `PACKAGE.json.gameBuild`
  and the in-ZIP `ITCH_GUEST_BUILD_SHA.txt` both equal `44ba89c…`, SHA match verified
* `runtime/node.exe` bundled (64,794,232 B). nodejs.org is unreachable from this
  build host, so the official win-x64 binary is taken from the PyPI `nodejs-bin`
  wheel; the build now degrades to "use the node on PATH" instead of aborting
  after the game has already been built
* `RUN-DIAGNOSIS.cmd`: 50 CRLF lines, pure ASCII, single double-click
* the three tool files inside the ZIP are byte-identical to the tree
* no GitHub Actions anywhere in the path

## 6. What the packaged build actually does now (verified 2026-11-09)

The package is exercised the way the owner runs it — extract, double-click,
wait — on this build machine. Every claim below comes from that path, not from
a probe.

### The packaged tool did not work at all

`buildPackage` puts the game at `<package>/game`, but `p0run` resolved
`<package>/tools/p0diag/game`. `GET /` therefore returned **404**, `index.html`
was never served, `/__p0diag.js` was never requested, `window.__P0DIAG__` never
appeared, and all three scenarios sat out their full timeout reporting
`no report`. The self-tests had been running inside the repository, where
`tools/p0diag/game` exists, so they could never have caught it.

The root is now resolved explicitly (`<script dir>/game`, then
`<package>/game`), the chosen path is logged, and the launcher exits with both
paths printed rather than waiting eight minutes on a wrong root.

### BOT cannot host the FROST arms, and says so

The production BOT path pairs the player against the CPU the product picks
(`HUNTER` on this build) and refuses a FROST opponent by design. `APEX_FROST_GOLD`
is never created, so there is no ice renderer and no ambient entry point to
switch off. Those two arms now report **inapplicable with a reason**:

```
bot        full ✓  noIce ⊘  noAux ⊘  noBloom ✓  full ✓     3/5
local-perf full ✓  noIce ✓  noAux ✓  noBloom ✓  full ✓     5/5
local-high full ✓  noIce ✓  noAux ✓  noBloom ✓  full ✓     5/5
```

Applicability is decided from whether the seam was ever installed, so a module
that loads late cannot rewrite an arm after the fact.

### Casts are counted in game seconds, and the report says when that ruins the run

`debugState().skills.A1.cd` decreases 7.93 → 7.31 over 13.5 real seconds on this
host: cooldowns advance with the simulation, and the software rasteriser here
runs the simulation roughly twenty times slower than real time. A 16-second arm
can end before any cooldown expires, so a run can legitimately confirm zero
casts. When that happens the verdict is **`no-cast-accepted-cannot-judge`**
rather than a subsystem name — the render proofs below are still valid, but the
cast-cost question is reported as unanswered instead of guessed.

### Delivery

`uploads.github.com` drops the TLS connection from the build machine and the
repository is private, so the release cannot take an asset. The ZIP is stored in
the repository as nine 12 MB parts beside `ASSEMBLE-PACKAGE.cmd`, which joins
them, verifies the SHA-256 and opens the folder. Current package:

| | |
|---|---|
| bytes | `99469262` |
| sha256 | `c625d2856401d7fab84d63818b753d6668e18074d9b30586b05dc79a649f1559` |
| game build | `44ba89c1f0d36422c1b08412dfeeb66863662a1c` |

The download path was verified by fetching all nine parts back from GitHub,
reassembling them and checking the hash and archive integrity, then running the
extracted launcher: `game: <package>/game`, three scenarios, three reports.
