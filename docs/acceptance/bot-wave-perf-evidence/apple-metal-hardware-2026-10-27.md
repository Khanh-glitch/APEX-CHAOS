# BOT WAVE — validated Apple Metal hardware diagnostic (2026-10-27)

**Status: hardware-backed bottleneck evidence, not a product performance fix.** This capture was run hands-free by GitHub Actions on the PR #110 investigation branch. No shipped renderer, gameplay, HUD Gold, navigation, graphics resolution, particles or bot count was altered.

## Reproducible environment

- Workflow run: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/40516188014
- GitHub Action: `.github/workflows/bot-wave-apple-gpu-probe.yml` (`macos-26` standard arm64)
- Adapter: Chrome/ANGLE Metal **Apple Paravirtual device** (Apple virtualized hardware-backed GPU; **not SwiftShader**)
- Chrome: 156.0.8078.48 on macOS 26.6.2
- Mobile-like browser viewport: **844×390 @ devicePixelRatio 2**; native scene: 1688×780 px
- Captured **65 seconds** with native BOT WAVE 14 bots, periodic native wave/heat effects, six abilities available and trusted Chrome keyboard events.
- Test fixture only: extended in-memory player health to prevent death and clicked native `.w-card` upgrade buttons automatically. Entire shipping renderer and gameplay source untouched.
- All 26 runtime state samples were **combat, unpaused**. Final runtime phase combat; 14 bots; zero uncaught browser exceptions.

## Measurements

| Metric | Result |
|---|---:|
| RAF frame intervals | 3,656 |
| Mean FPS | **29.15** |
| 1% low FPS | **8.57** |
| Frame P50/P95/P99 | 33.3 / **66.7** / **116.7 ms** |
| Maximum frame gap | 566.6 ms |
| Trusted keyboard input events | 134 |
| Event-to-next-RAF P95/P99 | **70.1 / 148.6 ms** |
| Long tasks | 66; max 285 ms |
| GPU swap `SkiaOutputSurfaceImplOnGpu::SwapBuffers` | P95 **32.88 ms** |
| Metal `CALayerTreeCoordinator::ApplyBackpressure` | P95 **27.15 ms** |
| Trace event count | 2.54 million |
| Raw trace size | 419.7 MiB |

This data demonstrates a frame pacing problem on the **virtualized Apple Metal GPU**, but not necessarily the identical bottleneck on Android/iOS.

## CPU profiler hot paths

After excluding Chrome profiler `(idle)` and `(program)` categories, approximate share of **non-idle sampled CPU stacks by leaf function**:

| Function | Samples | Share |
|---|---:|---:|
| Fluid solver `project()` | 6,627 | **40.0%** |
| Fluid solver `step()` | 1,538 | **9.3%** |
| Fluid solver `advect()` | 1,238 | **7.5%** |
| `drawImage` native entry points | 1,837 | 11.1% |
| `putImageData` | 807 | 4.9% |

The solver lives in the Gold bundle in `public/bot-wave/game.html`, around `project` (line 903), `advect` (line 882) and `step` (line 925). `project()` performs **14 pressure-solver iterations** over the active fluid grid. Do **not** reduce fluid grid size, solver iteration count or fire/smoke effect quality without explicit owner approval.

**Evidence-based next engineering step:** instrument the fluid solver's active-cell bounding box, invocation count and solver milliseconds per frame and correlate them with high frame P95/P99. Test lossless optimizations (allocation reduction, loop/data locality, typed-array access, equivalent numerical solver schedule, or a parity-proven GPU/worker implementation). Also inspect Chrome compositor backpressure independently. Use paired same-run, same-scene A/B with visual correctness checks; no approximation by FPS assertions alone.

## Evidence and limits

All original raw files (Chrome trace, CPU profile, start/end screenshots, summary JSON) are in artifact **`apex-bot-wave-metal-hardware-trace`** from the workflow URL above.

The GPU is paravirtualized Apple Metal, **not** a physical phone GPU. This is a valid hardware-accelerated diagnostic but not device-release acceptance. `inputToNextRaf` is not input-to-photon latency; Chrome trace task duration is not shader timing. No optimization has been accepted and PR #110 must remain draft.
