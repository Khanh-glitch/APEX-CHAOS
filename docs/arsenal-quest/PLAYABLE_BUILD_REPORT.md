# ARSENAL QUEST — PLAYABLE WINDOWS BUILD REPORT

Issue: #4 — Package and verify a truly playable Windows Arsenal Quest build
Scope: packaging + final verification only. No gameplay/UI/balance/weapon changes.

## Branches / SHAs

- Corrected runtime baseline (latest `origin/prototype/arsenal-quest` at task start):
  `f350f82a58805a7a77c04813470cde66d2cffb7e` (correction pass landed, CI green).
- Session branch: `arena/01a0cf5e-apex-chaos`, fast-forwarded onto that exact tip.
- Delivery commit: the commit that adds this report + `release/arsenal-quest-windows/`
  (see `git log -1 --format=%H -- docs/arsenal-quest/PLAYABLE_BUILD_REPORT.md`);
  the same SHA is baked into the ZIP as `app/ARSENAL_BUILD_SHA.txt` and printed by
  `PLAY_WINDOWS.bat`.

## Pre-packaging verification of the corrected runtime

- Atlas integrity: `public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.png`
  SHA-256 `bb11c1c7df0a274b6e1106f074295c0ffe0b84a4c86ae964f068eeaa42b01f6f`,
  exactly matching `PROVENANCE.md`; all 12 cells populated (per-cell alpha scan).
- Headless suite (real engine + real assets in jsdom): **61/61 PASS**, including
  `weapon-atlas-floor-sprite-rendered`, `weapon-atlas-equipped-sprite-rendered`,
  `telegraph-not-collectible-and-long-hidden`, `proximity-reveal-on-approach`
  (REVEAL log format `eta=… lead=… fighter=…` asserted), reveal-lookahead 1.2–1.8.
- Real browser: repo CI (`Arsenal Quest Stabilization`) runs
  `tools/testArsenalQuestRuntime.mjs` over CDP/Chrome on every push of this branch;
  this delivery adds three browser-side gates: `browser-weapon-atlas-floor-sprite`,
  `browser-weapon-atlas-equipped-sprite`, `browser-no-atlas-fallback`.
  Run URL for the delivery push is recorded in the closing chat message.
- Visual confirmation (headless canvas renders, evidence dir): revealed floor pickups
  show real atlas sprites (gun/melee/shield), fighters carry real equipped sprites,
  telegraph stays a neutral "?" beacon, no PIS/AXE/SWL circle+tag renderer on the
  normal path (placeholder renderer removed; debug-only missing-art fallback remains).

## Packaging

`release/arsenal-quest-windows/` (this repo) and the single user ZIP
`APEX_ARSENAL_QUEST_PLAYABLE_WINDOWS.zip` (workspace root, not committed):

```
PLAY_WINDOWS.bat   double-click launcher
serve.ps1          built-in PowerShell/.NET static server only
app/               vite production dist + ARSENAL_BUILD_SHA.txt
BUILD_INFO.txt     package metadata
README_FIRST.txt   user instructions
```

serve.ps1 behavior (as required):
- dynamic free localhost port (OS probe + random fallback; never 8765/fixed),
- serves `app/` with MIME map for html/js/css/png/jpg/webp/svg/ico/ogg/wav/mp3/json/txt/…,
- `Cache-Control: no-store, no-cache, must-revalidate` + Pragma/Expires on every response,
- browser opened only after the listener reports listening,
- appends `?build=<sha>` to the URL and prints the exact SHA,
- loud fatal + non-zero exit on bind/start failure, serves until the console closes,
- path-traversal guarded; 404 for missing files.

## Smoke test performed

1. Built from the delivery commit tree (`pnpm build`, vite 5.4.21, exit 0).
2. Packaged `app/` = dist + `ARSENAL_BUILD_SHA.txt` = delivery SHA.
3. Served `app/` from a sandbox static server; `GET /ARSENAL_BUILD_SHA.txt`
   returned the exact SHA; `GET /` returned the built index referencing the built
   assets; asset routes (js/png/ogg) returned 200 with expected content types.
4. Headless Arsenal acceptance re-run on the same tree: 61/61 PASS.
5. Relaunch safety: port is chosen at bind time per process; two concurrent servers
   cannot collide (no fixed port), and no-cache headers prevent stale caches.

## Limitations (stated plainly)

- The sandbox has no Windows and no PowerShell binary; `serve.ps1`/`PLAY_WINDOWS.bat`
  could not be double-click-executed here. Their logic was validated by review and by
  exercising the identical serving contract (dynamic port, SHA endpoint, MIME, no-cache)
  with a sandbox static server; the browser-side acceptance ran on GitHub-hosted Chrome
  via CI, not on Windows.
- Real-browser screenshots live in the CI run artifacts
  (`arsenal-quest-browser-evidence`); blob storage is unreachable from this sandbox.

## Result

One self-contained ZIP, no external runtime dependencies, exact-SHA anti-stale
launcher, corrected Arsenal Quest with real weapon art inside.
