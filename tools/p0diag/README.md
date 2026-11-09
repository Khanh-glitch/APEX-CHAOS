# tools/p0diag — APEX CHAOS P0 diagnosis package

Offline Windows diagnosis launcher for the frozen Arsenal Battle build.
See the task brief "APEX CHAOS — P0 DIAGNOSIS FINALIZATION".

## Contents

- `p0diag.js` — Node.js diagnosis launcher (no dependencies; Node built-ins only).
  Also copied into the packaged ZIP at `diag/p0diag.js`.
- `p0diag.test.mjs` — unit tests for cast accounting, verdict logic and
  packaged-game integrity (`node tools/p0diag/p0diag.test.mjs`).
- `diag/runner.html` — same-origin in-page arm automation served by the
  packaged static server (runs in Chrome on the owner's machine).
- `assemble/ASSEMBLE-PACKAGE.cmd` — recombines `assemble/parts/*.00*` into
  `apex-p0diag-diagnosis.zip`.
- `assemble/parts/` — nine binary parts of the diagnosis ZIP.

## Package layout (inside the ZIP, extracted by the owner)

```
RUN-DIAGNOSIS.cmd          # launch the diagnosis (needs Node + Chrome/Edge)
PLAY_WINDOWS.bat           # play the frozen game normally
serve.ps1                  # localhost static server + result endpoints
app/                       # frozen game build + ARSENAL_BUILD_SHA.txt
diag/build.expect          # expected build SHA (written at assembly)
diag/p0diag.js
diag/runner.html
node/                      # place node.exe here if Node is not on PATH
results/                   # written at run time (report.json / report.txt)
```

## Mandatory fixes implemented

1. **Cast accounting** — each arm owns `pressed`/`confirmed` counters; the run
   owns independent cumulative counters; no arm resets the cumulative counters;
   a confirmed cast is counted only on the gameplay-authority `Cast` bus event
   (successful `tryCast`, never a raw key press); the verdict distinguishes
   zero accepted casts across the entire run (`no-cast-accepted-cannot-judge`)
   from zero casts in one arm (`no-cast-in-arm`). Unit tests cover casts in
   early arms followed by a cast-free final arm.
2. **Comparable arms** — every arm restarts the match from a deterministic
   seeded state (same seed, same validated skill/J-press schedule) and records
   actual fighters/graphics mode, confirmed casts by hero+skill, combat state at
   start of measurement, frame sample count, intended-vs-actual renderer
   suppression, and a scientific-validity flag. Arms that cannot establish
   comparable conditions are reported inconclusive rather than attributing a
   bottleneck. The BOT scenario uses the production CPU opponent HUNTER and
   never claims to diagnose FROST.

## Local acceptance (this sandbox, no browser/Windows)

- `node tools/p0diag/p0diag.test.mjs` — 14 tests pass.
- ZIP reassembly from the nine parts is byte-identical (SHA-256 verified).
- `validatePackagedGame` confirms `app/index.html`, `app/ARSENAL_BUILD_SHA.txt`
  and `diag/build.expect` agree on the extracted package.

The measurement itself (Chrome drive) runs only on the owner's Windows
machine; sandbox measurements are not used to claim owner-device FPS.

## Publishing

The full ZIP is published as a GitHub Release asset when release upload is
available; otherwise the nine parts under `assemble/parts/` plus
`ASSEMBLE-PACKAGE.cmd` are the distribution (reassemble with `copy /b`,
then extract and run `RUN-DIAGNOSIS.cmd`).
