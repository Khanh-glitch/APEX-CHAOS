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
