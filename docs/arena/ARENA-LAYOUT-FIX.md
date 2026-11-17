# APEX CHAOS — Arena layout integration hotfix

## Diagnosis from the previous release
The game's **Gold** UI dynamically moves the real `#game-canvas` into `#battleHudHost #arena`. The Total Evolution GPU shader compositor mistakenly injected a *second visible* canvas right after the real one, then placed it using `offsetLeft` and `offsetTop`, ignoring Gold's `left:50% / top:50% / translate(-50%, -50%)` transform. The whole rendered scene was therefore **duplicated and shifted down/right**. It could also protrude over adjacent player panels as the Gold layout resized. The extra React tactical dock was positioned against the browser window rather than the arena, overlapping Gold rails.

## Changes
- GPU effects still run via the *same original WebGL shaders* (bloom, light, lensing, shockwaves), but render to a **detached offscreen canvas**, then copy the final result into the authoritative 2D game canvas. No independent rendered map element remains in the DOM.
- Match canvas remains under **Gold's existing ResizeObserver**, avoiding duplicate resize authority or unexpected CSS transforms.
- Tactical HUD now computes the real screen rectangle of Gold's `#arena`, following it during resizing. Event banner, popover, guide and bottom dock are restricted to the arena width; no overlay onto P1/P2 side panels.
- The five original stage definitions, hazards, background drawings and game physics were **not rewritten**. The stage selection continues to use the donor arena adapter.
- `npm run verify:arena` checks for accidental re-introduction of two visible arena canvases and verifies all five stages and key integration contracts.

## Tests performed
- Chromium isolated arena renderer, at **1826×718, 1280×720 and 430×932** viewport dimensions: all 5 stages loaded and rendered; no JavaScript exceptions; no extra GPU canvas was inserted; the tactical dock stayed inside the arena rectangle and did not intersect the simulated side panels.
- Node syntax check on shader compositor: passed.
- Automated static integration guard: passed.

**Limitations:** This is source for a Vite deployer, not prebuilt `dist`. The container has no installed Vite toolchain or network access to download dependencies. The isolated Chromium here reports WebGL2 unavailable, so browser GPU output and full production Gold UI could not be end-to-end tested. The fallback 2D arena was verified. The original donor package also lacked some original texture assets; this hotfix does not restore them.

## Deploy
Upload the ZIP to a source-code platform supporting Vite. `npm ci` -> `npm run verify:arena` -> `npm run build` -> serve `dist/`. Makers may require a unique new project name (unrelated to ZIP filename).
