# BOT WAVE lossless-render performance investigation

**Status: NOT READY for release.** The lossless refraction-copy adapter remains opt-in (`?refractionCopy=on`); the shipping default is the approved baseline. The historical one-shot measurements below are not acceptance evidence. The 2026-10-27 root-cause investigation adds Chrome Performance traces and three 60-second paired stress runs; they still show no stable candidate improvement, and there has been no physical Android/iOS device test. Do not publish this as a performance fix or call mobile performance fixed. See [the root-cause report](root-cause-investigation-2026-10-27.md).

## Scope and safety

- Approved Gold Post implementation SHA-256 remains `299d361529ea57a99af999bbfcf9e200beb73daf959587a81d3216c0096eb345`.
- The candidate skips unchanged pixels only when copying the refraction history; it uses conservative region merging and a full-frame fallback. It does not lower DPR, render resolution, effects, bots, particles, or game speed.
- Detailed render/post/Canvas/GC instrumentation is also opt-in (`?wavePerf=on`); it does not install those extra per-frame wrappers on the production-default route.
- The change is disabled unless `?refractionCopy=on` is present. Gold gameplay and graphics remain on the original path by default.
- The `APEX HOME` control was moved from the top-center to the bottom-center of the BOT WAVE wrapper after visual inspection showed it covering the centered wave title. It now stays out of the central/top HUD; mobile landscape still shows the touch joystick at lower-left.

## Tests and observed results

- `corepack pnpm test:bot-wave:render-contract`: PASS.
- `corepack pnpm test:bot-wave:refraction-parity`: PASS; four profiles (1440×900 DPR1, 844×390 DPR2, 390×844 DPR3, compact 420×280 DPR1), 12 frames/profile, **zero changed pixel channels**. Compact profile exercised the full-frame fallback without errors.
- Actual production-preview Chromium wrapper QA: desktop and 844×390 DPR2 mobile-landscape loaded the Gold pilot, HUD, command bar, onboarding/start control and wrapper Home control without page exceptions; detailed telemetry was confirmed disabled by default. In the latest six-second input-window check, desktop KeyD moved 67.4 world units with 0.250 s of game-clock advance; emulated mobile touch moved 15.6 units with 0.233 s of game-clock advance. Both assert eventual movement only; neither establishes acceptable input latency, smoothness, or physical-device behavior. The mobile joystick remains visible at x=7, y=328, 55×55 CSS px, anchored lower-left.
- Browser pixel comparison: six synthetic effect frames, zero changed channels, max difference 0. Deterministic browser-canvas comparison is not a full-game screenshot/video comparison.
- Production build completed with the repository build script. One pre-existing Vite warning remains about the `ecoNewbotV17Gold.js` static/dynamic import mix.

## Repeated 60-second A/B and Chrome trace (latest; still not acceptance)

The full paired results and trace analysis are in [the root-cause report](root-cause-investigation-2026-10-27.md). Three counterbalanced 60-second off/on pairs used the same desktop 1440×900 conditions, 14 live bots, 84 descriptors, six skills, and recurring VFX. Candidate median paired changes were frame P95 **+6.69%**, frame P99 **+7.01%**, input-to-next-frame P95 **+4.49%**, input P99 **+7.90%**, render P95 **+0.61%**, and post P95 **+4.85%**. Stable improvement was false; keep the candidate opt-in.

A separate 12-second wrapper trace used headless Chrome with ANGLE SwiftShader / in-process GPU. It found severe GPU-thread stalls and sparse RAF delivery, while the longest recorded main-thread long task was 71.5 ms. This localizes the headless test bottleneck but cannot establish physical-GPU/mobile behavior or explain the owner's real-device stalls. Repeated stress reports and raw trace are retained in the ignored `reports/` evidence directory.

## Historical one-shot A/B measurements (diagnostic only)

The direct-game Chromium profiles used a single 1,000 ms sample after 500 ms warmup, with scripted wave/heat VFX and four bots at sample end. These are superseded by the longer paired run above, too short/noisy for acceptance, and were not repeated in randomized order. The browser was headless Chromium with SwiftShader/software rendering, not a phone GPU.

| Viewport | Mode | FPS estimate / 1% low | Frame gap P50 / P95 / P99 (ms) | Render P95 (ms) | Post P95 (ms) | Long tasks / max (ms) | Refraction pixels avoided |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop 1440×900 DPR1 | Off | 42.00 / 12.97 | 16.9 / 36.1 / 77.1 | 16.9 | 2.1 | 2 / 66 | 0 |
| Desktop 1440×900 DPR1 | On | 45.28 / 13.99 | 17.0 / 40.5 / 71.5 | 17.1 | 0.9 | 0 / 0 | 42,190,679 |
| Mobile viewport 844×390 DPR2 | Off | 37.49 / 11.17 | 16.9 / 77.0 / 89.5 | 49.6 | 4.0 | 2 / 66 | 0 |
| Mobile viewport 844×390 DPR2 | On | 41.80 / 15.60 | 17.3 / 39.1 / 64.1 | 9.9 | 0.7 | 0 / 0 | 42,655,742 |

The mobile one-shot appears substantially better with the candidate, but the result is not repeatable evidence: the baseline had two 66 ms long tasks, the sample was only about 40 frames, and the run order/cache state can explain much of the difference. A second unpaired mobile candidate sample measured 44.20 FPS / 14.35 1% low, frame gaps 16.6 / 51.0 / 69.7 ms, render P95 9.4 ms, post P95 0.9 ms, and one 63 ms long task—materially different from the first candidate run. Desktop frame-gap P95 and render P95 were slightly worse with the candidate even though some other percentiles improved. Candidate refraction-copy draw time itself was about 4.1 ms desktop and 3.8–4.0 ms mobile in these samples.

A second, final-commit production-preview mobile A/B pair (same 1,000 ms stress scenario, one run each) was also mixed: off = 47.28 FPS, frame P95 34.0 ms, render P95 23.1 ms, post P95 0.6 ms; on = 43.78 FPS, frame P95 44.4 ms, render P95 11.7 ms, post P95 1.3 ms. The candidate avoided 43.9 million copied pixels but average FPS and frame-gap P95 regressed. This confirms that fewer copied pixels do not guarantee a faster overall frame. The adapter is therefore not enabled by default.

Update/render/post/input histograms, draw/clear cost records, frame-gap estimates, long-task observations, heap readings, post-surface estimate and refraction-copy counters are available from `window.APEX_WAVE_PERF.snapshot()` and `window.APEX_WAVE_REFRACTION_COPY.snapshot()` in the test harness. GC entries are implementation-dependent and unsupported by this headless Chromium build. Reported heap values were flat at 10 MB and are not a physical GPU-memory or long-session measurement.

## Visual evidence reviewed

The actual wrapper entry and combat frames were opened and inspected during QA. The mobile frame shows the Home control at bottom-center rather than covering the top-center wave title, and the touch joystick remains anchored at bottom-left. The desktop and mobile performance captures are independent moments under stress; their effects/actor timing differs, so they are **not** pixel-parity evidence.

- [Mobile wrapper entry/onboarding](screenshots/mobile-wrapper-entry.png)
- [Mobile landscape wrapper combat and touch control](screenshots/mobile-wrapper-combat.png)
- [Desktop wrapper combat](screenshots/desktop-wrapper-combat.png)
- [Desktop direct-game off](screenshots/desktop-off.png) / [on](screenshots/desktop-on.png)
- [Mobile DPR2 direct-game off](screenshots/mobile-landscape-dpr2-off.png) / [on](screenshots/mobile-landscape-dpr2-on.png)
- [Gold parity frame](parity/frame-01-gold.png) and [candidate parity frame](parity/frame-01-candidate.png) are pixel-identical; the full browser test reports six frames with zero changed channels.

## What is not established

- The root cause of the owner's reported 180–300 ms stalls on real hardware is still unknown. The wrapper trace's severe GPU-thread stalls are specifically from headless SwiftShader; main-thread long tasks peaked at 71.5 ms in that trace. These are not proof of the production-device bottleneck.
- Candidate CI had intermittent failures: `40499986580` passed, `40501946197` failed candidate profiling after 21 seconds with an 8.16 MB diagnostics artifact, and the later runs `40502228713`, `40503332963`, and `40503338072` passed. The artifact's exact assertion is not inspectable here because log/ZIP downloads return EOF. Current head candidate CI is green; the profiler now emits a GitHub error annotation with mode/profile/stage/assertion text if a future run fails.
- Latest Product Acceptance runs `40503338073` and `40503332837` fail at the aggregate gate because of the inherited runtime-revision mismatch on five Shuri files verified unchanged from the PR base. This is unrelated baseline debt and has not been fixed or hidden in this BOT WAVE scope; see the root-cause report.
- No 60 FPS / 1% low target was demonstrated; the headless results are below 60 FPS and noisy.
- No real Android/iOS browser, high-refresh phone, physical touch latency, fullscreen/rotation cycle, Home-navigation return flow, long-session memory/GC trend, or multi-wave/boss session has been verified.
- Screenshots are point-in-time visual checks, not a full Gold UI acceptance or full-game video parity capture. They show VFX timing differences and must not be compared pixelwise as identical gameplay states.
- No itch.io release ZIP is designated ready while these acceptance gaps remain.

## Reproduction

The checked-in CI workflow builds the production preview, runs the render contract and deterministic parity tests, smoke-tests desktop and mobile wrapper/input behavior, and uploads separate off/on Chromium profiles and screenshots. It uses SwiftShader, so a green CI run still cannot satisfy physical-device acceptance.
