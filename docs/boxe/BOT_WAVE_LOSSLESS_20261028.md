# BOT WAVE lossless optimization — reviewed 2026-10-29

Baseline: cccc6acac918e9b5f05891641f9fed2fcc044175, the newest remote branch tip found across the repository at task start (2026-10-28 16:31:56 +07:00), on design/home-command-dock-gold-20261028. The PR targets that branch rather than the older default branch.

The candidate keeps the baseline Gold core, ten original PNGs, native Arsenal physics/audio, particle counts, fluid resolution, all 14 pressure iterations, camera, DPR, blur/bloom/refraction, and HUD cadence.

## Implementation

- Fuse adjacent advection pairs while preserving double-precision arithmetic order, Float32 stores and the baseline velocity-source behavior. An unfamiliar solver falls back to its own advection.
- Reuse the exact smoke raster bytes for the second smoke layer in a render, keeping depth order and the second upload. Removing that upload caused 37 differing Chrome channels and was rejected. Invalidate on mutations and frame boundaries.
- Keep the complete Fury fragment shader unchanged. When active, scissor to a conservative region proved to contain every nontransparent pixel. At exact zero intensity, clear once and retain the already transparent GPU/particle canvases. Clocks, intensity and existing particles continue advancing; active rendering resumes normally after resize or Fury re-entry.
- Replace nearest-target filter/sort with a linear scan retaining distance/ID ordering; read HUD canvas sizes before marker DOM writes.
- Register the runtime, refresh both entry-path cache keys to lossless-fluid-r2, update the signed graph to 71 runtimes and extend CI.
- Profile the actual Home entry with startup recorded separately, reset only diagnostics, and move refraction readback outside the measured window. A pinned-baseline ABBA harness reports every round in isolated browser contexts.
- Repair two stale browser-test assumptions exposed by CI: compare complete resolved Dictionary image URLs and open Help through the current Home SYSTEM drawer. Decoded-image, visibility, localization and hitbox assertions remain in place.

## Measured component results

Final paired Chrome run: nine alternating-order rounds in one process, shipping WASM backend, original versus optimized implementations. Medians:

| Work | Baseline | Candidate | Reduction |
| --- | ---: | ---: | ---: |
| Full-grid fluid step | 7.127 ms | 6.420 ms | 9.9% |
| Two smoke layers + fire, including canvas flush | 6.475 ms | 5.645 ms | 12.8% |
| Fury shader draw area over the 40-case/idle suite | 6,013,620 pixel slots | 392,584 pixel slots | 93.5% |
| Fury framebuffer clear calls in that suite | 180 | 55 | 69.4% |

The draw-area count is a proxy for shader work, not elapsed GPU time or an FPS gain. The candidate submits no new draw/clear commands during the tested stable transparent interval. A zero timer median means below timer resolution. Earlier paired fluid measurements showed 5.5% step and 8.2% raster reductions; retain those raw samples too.

## Correctness and product validation

- 1,800 bitwise field comparisons in Node and 192 with the shipping WASM backend in Chrome; existing pressure parity covers 120 repeated full/partial-grid cases.
- 36 fluid pixel cases at DPR 1/1.5/2 and three zooms; 40 Fury framebuffer/particle cases, including idle resize and active re-entry: **0 differing channels** in all 76 cases. Both Fury shaders are byte-for-byte identical.
- Baseline Gold core remains 905,635 characters, SHA-256 bf365b1b40261af35d607d9024922f705b99dce6363195fee87bbfd8e90f26f7. The former fidelity test pinned the older pre-WASM core; it now locks this exact latest baseline. All ten PNG hashes stay fixed.
- Real Chrome: native keyboard locks, Sticky J, hold-K guard, unlock chain, positive U/I casts, Home entry/return, all 41 native weapon executors, 95 art/SFX references, native audio and arena/HUD bounds on desktop and landscape. Dictionary images pass both viewports; portrait Help passes 16 assertions across ENG/VIE and two sizes.
- Production Vite compilation, original Gold source checks, asset audit/pruning, direct-port contracts, 481-asset shipping gate, runtime hygiene and 71-runtime receipt gate pass. Windows build stages were invoked directly after pnpm symlink limitations; CI exercises the standard package build.

## Whole-frame limits and rejected variants

The first wrapper diagnostic mixed startup and refraction pixel readback into the timing window (p95 1015.8 ms desktop / 507.9 ms landscape). Preserve it as historical diagnostic evidence, not steady-play performance. The corrected profiler uses shipping Home, records startup separately, settles 2.5 seconds, then samples movement/rendering before readback. Instrumentation PASS confirms valid samples and live controls, not smoothness.

Eagerly creating 13 original smoke textures plus the original fire texture bank was tested, then **removed from the final product**. A Home run with it still showed frame-gap p95 327.4/367.9 ms. Its formal ABBA p95 sequence was 108.4 / 708.2 / 62.6 / 49.3 ms (baseline / candidate / candidate / baseline), including a severe candidate regression. Do not hide or average away that outlier. The evidence does not prove warmup caused it, but also does not justify retaining speculative eager work.

With that warmup removed, a subsequent ABBA isolation run reported p95 **46.6 / 52.9 / 50.2 / 47.4 ms** in the same order. Candidate median gaps were 26.1/28.3 ms versus baseline 25.7/25.4 ms. This early-wave desktop sequence establishes neither a whole-game speedup nor lag-free play. Keep the raw movement/clock samples and all four rounds. Chrome/compositor/host load and unsynchronized native AI vary; viewport emulation is not physical-phone testing. Later-wave and representative-device acceptance remain open.

On the final rebuilt product without eager warmup, the corrected Home profiler recorded frame-gap p95 58.3 ms desktop / 77.5 ms landscape, render CPU p95 6.3/7.1 ms and input-queue p95 2.8/14.2 ms. Measured-window long tasks were zero; the 750 ms W input advanced the game clock .789/.820 s and moved 250.4/244.5 px. This is healthier than the rejected-warmup observation but is not a paired causal proof or smoothness acceptance. Startup remains separate and visible in the raw report.

An earlier exploratory sequence (74.3 / 52.3 / 49.0 / 50.0 ms) is also retained. An opaque main-canvas experiment matched pixels in 16 cases but did not improve full-frame performance consistently and was rejected. No resolution, DPR, shader, particle budget, optical pass, pressure iteration or HUD cadence reduction was used.

**PR remains draft:** exact image/state parity and component gains are established; complete-frame performance acceptance is not. No 60 FPS, universal speedup or no-lag claim is made.

## Evidence and reproduction

[Final Home profile](perf-20261028/home-final-profile.json), [final fluid](perf-20261028/fluid-final.json), [final Fury](perf-20261028/forge-final.json), [ABBA without warmup](perf-20261028/whole-frame-no-warm.json), [rejected-warmup ABBA](perf-20261028/whole-frame-prewarm.json), [rejected-warmup Home](perf-20261028/home-prewarm-profile.json), [earlier exploratory ABBA](perf-20261028/whole-frame-exploratory.json), [earlier fluid](perf-20261028/fluid-comparison.json), [earlier Fury](perf-20261028/forge-comparison.json), [historical wrapper diagnostic](perf-20261028/live-profile.json).

Against a built preview, set CHROME_PATH and APEX_APP_URL. Fetch the pinned baseline object first if the checkout is shallow:

```sh
git fetch --depth=1 origin cccc6acac918e9b5f05891641f9fed2fcc044175
node tools/testBotWaveLosslessFluid.mjs
node tools/testBotWaveLosslessFluidBrowser.mjs
node tools/testBotWaveForgeLosslessBrowser.mjs
node tools/testBotWaveBrowserInputLock.mjs
node tools/testBoxeModeEntryChrome.mjs
node tools/profileBotWaveLosslessBrowser.mjs
node tools/compareBotWaveWholeFrameBrowser.mjs
```
