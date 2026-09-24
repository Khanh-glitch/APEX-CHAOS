# ARSENAL QUEST — PLAYABLE WINDOWS BUILD REPORT

Issue: #4 — Package and verify a truly playable Windows Arsenal Quest build
Scope: delivery / packaging / final verification only. No gameplay, balance,
progression, UI, or weapon changes in this pass.

## Source branch / SHA

- Session branch: `arena/01a0cf5e-apex-chaos`, layered on (descendant of) the latest
  `origin/prototype/arsenal-quest` at `f350f82a58805a7a77c04813470cde66d2cffb7e`
  (the completed correction pass).
- Packaged source SHA (value of `app/ARSENAL_BUILD_SHA.txt` inside the ZIP):
  the report-finalize commit (the commit containing this sentence); written from
  `git rev-parse HEAD` at assembly time immediately after that commit.
- Delivery / report-finalize commit: the commit containing this sentence
  (verify with `git log -1 -- docs/arsenal-quest/PLAYABLE_BUILD_REPORT.md`).

## Build result

- `pnpm install --frozen-lockfile` + `pnpm build` (vite 5.4.21): **passes**.
- `release/arsenal-quest-windows/app/` = exact production `dist/` contents plus
  `ARSENAL_BUILD_SHA.txt` (gitignored; assembled at delivery time, never stale in Git).
- Headless acceptance on the packaged tree: **61/61 gates PASS**
  (`node tools/testArsenalQuestHeadless.mjs`), including the correction-pass gates
  (proximity-predicted reveal, atlas floor/equipped sprites, VFX anchoring) and the
  five-minute no-error simulation.

## Package contents (inside `APEX_ARSENAL_QUEST_PLAYABLE_WINDOWS.zip`)

```
PLAY_WINDOWS.bat   double-click launcher
serve.ps1          built-in PowerShell/.NET static server
BUILD_INFO.txt     package metadata
README_FIRST.txt   how to play
app/               production build + ARSENAL_BUILD_SHA.txt
```

No Node, pnpm, npm, Python, Git, VS Code, or internet required.

## Launcher design (serve.ps1 / PLAY_WINDOWS.bat)

- Built-in .NET `System.Net.HttpListener` only.
- Port: asks the OS for a free ephemeral port first (`TcpListener` on port 0), then
  random probes; binds the first that accepts. **No fixed port anywhere (never 8765).**
- Serves `app/` with a MIME table for html/js/mjs/css/json/png/jpg/gif/webp/svg/ico/
  ogg/wav/mp3/opus/txt/map/woff/woff2, octet-stream fallback; path-traversal guarded.
- Sends `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache`,
  `Expires: 0` on every response.
- Opens the browser **only after** the listener reports listening; URL carries
  `?build=<sha>`.
- Prints the exact build SHA + URL; on bind/start failure it `Write-Error`s and
  exits 1, and the .bat pauses with a visible failure message (never silent).
- Keeps serving until the console closes; multiple concurrent instances each get
  their own free port.

## Anti-stale protections

- `app/ARSENAL_BUILD_SHA.txt` is written from `git rev-parse HEAD` of the packaged
  source commit at assembly time; the launcher reads and prints that same file, and
  appends it to the URL query.
- `app/` and the ZIP are gitignored, so Git never serves a stale embedded build; the
  CI smoke step re-assembles `app/` from the checked-out tree and asserts
  `GET /ARSENAL_BUILD_SHA.txt` equals `git rev-parse HEAD` of that checkout.
- Dynamic port + browser-after-listen means a relaunch can never open against an old
  server: the browser is pointed at the just-bound port only.
- CI smoke test launches **two** concurrent instances and asserts distinct ports.

## Runtime / browser verification

- Real-browser (Chrome) acceptance runs in CI on this branch
  (`.github/workflows/arsenal-stabilize.yml`), including the correction-pass gates
  `browser-weapon-atlas-floor-sprite`, `browser-weapon-atlas-equipped-sprite`,
  `browser-no-atlas-fallback`, proximity-reveal gates, and VFX anchoring gates.
  Browser evidence PNGs are committed back to the branch by CI under
  `docs/arsenal-quest/browser-evidence/` for in-repo visual review.
- Verified from that evidence: real weapon sprites on the floor and on fighters,
  no PIS/AXE/SWL placeholder circles in normal gameplay, hidden telegraph persisting
  while unapproached, reveal at predicted-ETA threshold with `[AQ] REVEAL … eta=… lead=…
  fighter=…` logs.

## Launcher smoke verification (CI, pwsh on ubuntu)

Step "Smoke-test packaged launcher server (pwsh)" asserts on the runner:
1. `serve.ps1` starts and prints URL+SHA; 2. `GET /ARSENAL_BUILD_SHA.txt` equals the
checkout SHA; 3. `/` returns 200 with `no-store` cache headers and the app root div;
4. a curated asset path serves 200; 5. a second concurrent instance binds a different
port (no fixed/stale port). Limitation: `.bat` double-click and Windows-specific
browser auto-open cannot be executed in this Linux sandbox/CI; the .bat is a thin
wrapper (`powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1` + visible
failure pause) and serve.ps1 itself is what the smoke test executes.

## Delivery SHAs

- Packaged source SHA (in `app/ARSENAL_BUILD_SHA.txt` and printed by the launcher):
  the report-finalize commit below; the ZIP was assembled from that exact tree
  (final rebuild, exactly once, after full CI verification).
- Verification CI run: **35959219649 — SUCCESS** on `abb0409` (serve.ps1 URI fix +
  CI evidence-staging fix): headless 61/61; launcher smoke PASS with concurrent
  instances on ports 44001 and 35869; real-browser suite 47/47 PASS including all
  weapon-atlas sprite gates; evidence committed back by CI as `97bf0a7`
  (`docs/arsenal-quest/browser-evidence/` + `docs/arsenal-quest/ci-logs/`).
- Report-finalize commit: the commit containing this sentence.
- ZIP workspace path: `APEX_ARSENAL_QUEST_PLAYABLE_WINDOWS.zip` (repo root; gitignored
  by policy — delivered as the workspace artifact, not through Git).

## Known limitations

- ZIP is ~the full production dist size (whole Apex game assets), same footprint as
  the CI playable-build artifact; Arsenal-specific trimming was intentionally not
  done (would risk breaking shared menu/preload paths).
- Windows double-click behavior is verified by component (pwsh smoke of serve.ps1 on
  CI Linux + code review of the 6-line .bat), not by an actual Windows machine in this
  environment; stated plainly per issue #4.
