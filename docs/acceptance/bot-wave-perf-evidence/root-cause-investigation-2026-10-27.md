# BOT WAVE performance root-cause investigation — 2026-10-27

## Decision

**Not READY.** The opt-in refraction-copy candidate remains disabled by default. Three counterbalanced 60-second stress pairs did not show stable improvement in frame-time or input-latency P95/P99. The strongest Chrome trace is from `@sparticuz/chromium` on SwiftShader, so it diagnoses this headless run but cannot establish physical desktop/mobile GPU performance. No release package was produced.

## Reproducible stress conditions

`tools/benchmarkBotWaveStressAB.mjs` launched a fresh Chromium process for each treatment. Each pair used the same seed, viewport, initial campaign state, and input/effect schedule; treatment order was counterbalanced `off/on`, `on/off`, `off/on`.

- 1440 × 900, DPR 1; Chrome `HeadlessChrome/153.0.8010.0`.
- 14 live enemies created through campaign-authored weapon descriptors; six existing Gold/native abilities were unlocked for the test fixture.
- Real browser keyboard input: D movement plus J/K/L/U/I skill presses; simultaneous pressure-wave/heat VFX injected at 450 ms intervals.
- 60 seconds measured per run; 3 paired seeds (180 measured seconds per treatment). No one-second sample is used as benchmark evidence.
- Full machine-readable results: `reports/bot-wave-stress-ab-repeatable/ab-summary-desktop-1440x900-1793101636329.json` and its Markdown summary. Individual run files sit in the same directory.
- Reproduction command (against a production preview): `APEX_APP_URL=http://127.0.0.1:4173 APEX_STRESS_REPLICATES=3 APEX_STRESS_DURATION_MS=60000 APEX_PERF_WARMUP_MS=4000 APEX_PERF_BOTS=14 APEX_STRESS_SEED=20261027 APEX_PERF_PROFILE=desktop-1440x900 pnpm benchmark:bot-wave:stress-ab`.
- Wrapper trace command: `APEX_APP_URL=http://127.0.0.1:4173 APEX_TRACE_WRAPPER=1 APEX_PERF_MODE=off APEX_PERF_PROFILE=desktop-wrapper APEX_TRACE_DURATION_MS=12000 APEX_TRACE_BOTS=14 pnpm profile:bot-wave:trace`.

### Paired results (ms)

| Pair / seed | Frame P95 off → on | Frame P99 off → on | Input-to-next-RAF P95 off → on | Input-to-next-RAF P99 off → on |
|---|---:|---:|---:|---:|
| 1 / 20261027 | 4107.0 → 4450.2 (+8.4%) | 4473.6 → 5042.9 (+12.7%) | 3557.7 → 3717.6 (+4.5%) | 4415.6 → 4619.2 (+4.6%) |
| 2 / 20261028 | 4286.5 → 3099.7 (−27.7%) | 4588.3 → 4909.8 (+7.0%) | 3624.9 → 3346.7 (−7.7%) | 4230.1 → 4567.1 (+8.0%) |
| 3 / 20261029 | 4676.7 → 4989.4 (+6.7%) | 4943.5 → 5161.3 (+4.4%) | 3918.2 → 4199.5 (+7.2%) | 4452.0 → 4803.8 (+7.9%) |
| **Median paired delta** | **+6.7%** | **+7.0%** | **+4.5%** | **+7.9%** |

The candidate avoided roughly 44.6–51.0 million full-frame pixels per run, but that did **not** translate into stable frame or input-latency improvement. Candidate render/post timing also did not improve consistently. Each run retained 13–14 live actors and stayed in combat, but the game clock advanced only about 0.78–1.09 seconds over each 60-second wall-clock sample in this environment. These are severe failures for the headless stress setup, not acceptable performance results.

## Chrome Performance trace findings

Representative wrapper/iframe trace and machine-readable analysis:

- `reports/bot-wave-wrapper-trace-cpu/desktop-wrapper-off-1793100993990.trace.json`
- `reports/bot-wave-wrapper-trace-cpu/desktop-wrapper-off-1793100993990.summary.json`

The trace includes the actual Gold wrapper and its `wave` iframe, 14 campaign-authored enemies, simultaneous VFX/skills, and D/skill keyboard input. The iframe was visible and focused; gameplay was unpaused. The wrapper and game appeared as separate frame records. In this repro, the issue is **not explained by a hidden/background iframe or ignored key delivery**.

Chrome `SystemInfo.getInfo` identified the renderer as **ANGLE_SWIFTSHADER**, `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`, `inProcessGpu: true`; the profiling launcher explicitly selects SwiftShader. In that environment:

- App frame-gap P95/P99 were about **1,228 / 1,406 ms**; input-event-to-next-RAF P95/P99 were about **1,203 / 1,208 ms**. D movement did move the player, but responsiveness was poor.
- Chrome trace recorded GPU-thread `GPUTask` / `RasterDecoderImpl::DoEndRasterCHROMIUM::Flush` work up to about **1.4 s**. Compositor/Viz tasks were comparatively short. The renderer-main thread's longest top-level task was about **71 ms**; the app long-task observer reported one such task. Update/render/post P95 were about **9.3 / 15 / 4.4 ms**.
- The JS CPU profile sampled the game `render` function for about 89 ms total and `drawImage` for about 92 ms over the 12-second diagnostic window; `putImageData` accounted for about 60 ms. Chrome's Canvas2D trace saw thousands of `Canvas2DResourceProvider::Snapshot` events and `WritePixels` work (about 76 ms total, maximum about 13 ms in this trace).
- Eight major/minor GC root events totalled roughly 19 ms, with the largest about 8 ms. GC does not explain the multi-second gaps in this trace.

**Interpretation:** the directly observed long gap is dominated by the in-process SwiftShader GPU/raster path and missed frame scheduling, not multi-second JavaScript tasks or GC. Canvas2D submissions and post/VFX work feed that path. This is a diagnosis of the sandbox's software-rendered Chromium run; it does not prove that physical-GPU Chrome has the same root cause or severity. A hardware-accelerated desktop/mobile trace is still required before making a device-performance claim.

## Desktop movement and iframe QA

The old wrapper smoke only waited 800 ms after KeyD, which could land entirely inside a renderer/GPU stall and incorrectly passed on key delivery alone. It now holds KeyD for six seconds, records phase/visibility/focus/RAF time diagnostics, and requires both movement and simulation-clock advance. A fresh desktop wrapper run passed with **67.4 world units moved** and **0.250 s game-clock advance**. The mobile-landscape wrapper QA also passed with **15.6 units moved** and **0.233 s game-clock advance**. Both were combat, unpaused, visible, and focused. These establish eventual movement in the smokes, **not** acceptable input latency, smoothness, or a performance fix. The 14-bot stress still has multi-second input-to-next-frame P95/P99.

## Candidate Chrome CI failure: intermittent; exact assertion still unavailable

Run [40491444677](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/40491444677) passed baseline profiling and failed the candidate profiling step after about 18 seconds, with only the generic `Process completed with exit code 1` exposed. The instrumented rerun [40499986580](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/40499986580) passed all BOT WAVE steps, including candidate profiling, so the original failure did not reproduce in that run.

However, the next run [40501946197](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/40501946197) again passed the baseline and failed the candidate step, this time after **21 seconds**. Wrapper QA, render contracts, parity, and build all passed. The `if: always()` upload succeeded and GitHub reports an 8.16 MB evidence artifact containing the failure JSON/screenshot. The sandbox could list the artifact but both the log and ZIP download endpoints returned EOF; unauthenticated GitHub pages expose only the generic annotation. Therefore the exact failing assertion/runtime detail is captured by CI but **not yet inspectable from this environment**; it is not safe to guess.

The profiler writes the failure stage, runtime state/counters, console/network errors, and best-effort screenshot to JSON and `GITHUB_STEP_SUMMARY`. A GitHub `::error` annotation with profile, mode, stage, assertion message, and failure-file name has now been added so the next failure's precise cause can be retrieved from check-run metadata even if artifact downloading remains blocked.

## Inherited Shuri revision-gate classification

`test:runtime-revision` flags these files under the inherited `20261017-shuri-boxe-sfx-r2` lock:

- `public/game/arsenal/arsenalWeaponRuntime.js`
- `public/game/hero-rework/heroRegistry.js`
- `public/game/hero-rework/shuriBattleRuntime.js`
- `public/game/hero-rework/shuriGoldLibrary.js`
- `public/game/hero-rework/shuriGoldPresentationRuntime.js`

All five are present in the PR base and absent from this PR's changed-file set. They are inherited revision-gate debt, not BOT WAVE performance regressions. **Scope decision:** do not edit unrelated Shuri files or loosen the revision gate in this performance PR; track/fix that baseline issue separately. Product Acceptance runs [40499986527](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/40499986527) and [40501936630](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/40501936630) both fail at the aggregate “Verify product graph, source hygiene, runtime revision, and generated audio bank” step. Local validation confirms the runtime-revision subcheck is the inherited five-file mismatch listed above; do not misattribute this to the BOT WAVE changes. The aggregate check remains red until its owner resolves the inherited gate.

## Follow-up / release gate

- Keep the candidate opt-in and keep PR #110 draft.
- Do not claim READY, stable improvement, or physical mobile performance from this evidence.
- Preserve the failed candidate and inherited Shuri classifications; neither is hidden or relaxed.
- Candidate CI remains intermittent (one pass, two failures); inspect the captured failure detail, now surfaced through a GitHub error annotation, before assigning a root cause. Do not loosen or hide the failed gate.
- Require a repeated, counterbalanced hardware-accelerated desktop A/B, gameplay validation, acceptable frame/input P95/P99, and all applicable CI gates before changing readiness. No release ZIP was made.
