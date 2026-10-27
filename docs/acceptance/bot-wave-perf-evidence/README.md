# BOT WAVE lossless-render performance investigation

**Status: NOT READY for release.** The lossless refraction-copy adapter remains opt-in (`?refractionCopy=on`); the shipping default is the approved baseline. The measurements below do not establish a repeatable overall win, and there has been no physical Android/iOS device test or long-session acceptance run. Do not publish this as a performance fix or call mobile performance fixed.

## Scope and safety

- Approved Gold Post implementation SHA-256 remains `299d361529ea57a99af999bbfcf9e200beb73daf959587a81d3216c0096eb345`.
- The candidate skips unchanged pixels only when copying the refraction history; it uses conservative region merging and a full-frame fallback. It does not lower DPR, render resolution, effects, bots, particles, or game speed.
- Detailed render/post/Canvas/GC instrumentation is also opt-in (`?wavePerf=on`); it does not install those extra per-frame wrappers on the production-default route.
- The change is disabled unless `?refractionCopy=on` is present. Gold gameplay and graphics remain on the original path by default.
- The `APEX HOME` control was moved from the top-center to the bottom-center of the BOT WAVE wrapper after visual inspection showed it covering the centered wave title. It now stays out of the central/top HUD; mobile landscape still shows the touch joystick at lower-left.

## Tests and observed results

- `corepack pnpm test:bot-wave:render-contract`: PASS.
- `corepack pnpm test:bot-wave:refraction-parity`: PASS; four profiles (1440×900 DPR1, 844×390 DPR2, 390×844 DPR3, compact 420×280 DPR1), 12 frames/profile, **zero changed pixel channels**. Compact profile exercised the full-frame fallback without errors.
- Actual production-preview Chromium wrapper smoke: desktop and 844×390 DPR2 mobile-landscape loaded the Gold pilot, HUD, command bar, onboarding/start control and wrapper Home control without page exceptions; detailed telemetry was confirmed disabled by default. Emulated mobile touch moved the player 15.6 px; the joystick was visible at x=7, y=328, 55×55 CSS px, anchored lower-left. A desktop KeyD event reached the game canvas, but the latest production-preview sample showed 0 px movement and 0 game-clock delta over its short interval (an earlier dev-server smoke moved 12.0 px). Desktop wrapper movement is therefore not accepted as verified. This is automated headless input QA, not a physical touch-device test.
- Browser pixel comparison: six synthetic effect frames, zero changed channels, max difference 0. Deterministic browser-canvas comparison is not a full-game screenshot/video comparison.
- Production build completed with the repository build script. One pre-existing Vite warning remains about the `ecoNewbotV17Gold.js` static/dynamic import mix.

## One-shot A/B measurements (diagnostic only)

The direct-game Chromium profiles used a single 1,000 ms sample after 500 ms warmup, with scripted wave/heat VFX and four bots at sample end. One run per mode is far too short/noisy for acceptance; conditions were not repeated in randomized order. The browser was headless Chromium with SwiftShader/software rendering, not a phone GPU.

| Viewport | Mode | FPS estimate / 1% low | Frame gap P50 / P95 / P99 (ms) | Render P95 (ms) | Post P95 (ms) | Long tasks / max (ms) | Refraction pixels avoided |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop 1440×900 DPR1 | Off | 42.00 / 12.97 | 16.9 / 36.1 / 77.1 | 16.9 | 2.1 | 2 / 66 | 0 |
| Desktop 1440×900 DPR1 | On | 45.28 / 13.99 | 17.0 / 40.5 / 71.5 | 17.1 | 0.9 | 0 / 0 | 42,190,679 |
| Mobile viewport 844×390 DPR2 | Off | 37.49 / 11.17 | 16.9 / 77.0 / 89.5 | 49.6 | 4.0 | 2 / 66 | 0 |
| Mobile viewport 844×390 DPR2 | On | 41.80 / 15.60 | 17.3 / 39.1 / 64.1 | 9.9 | 0.7 | 0 / 0 | 42,655,742 |

The mobile one-shot appears substantially better with the candidate, but the result is not repeatable evidence: the baseline had two 66 ms long tasks, the sample was only about 40 frames, and the run order/cache state can explain much of the difference. A second unpaired mobile candidate sample measured 44.20 FPS / 14.35 1% low, frame gaps 16.6 / 51.0 / 69.7 ms, render P95 9.4 ms, post P95 0.9 ms, and one 63 ms long task—materially different from the first candidate run. Desktop frame-gap P95 and render P95 were slightly worse with the candidate even though some other percentiles improved. Candidate refraction-copy draw time itself was about 4.1 ms desktop and 3.8–4.0 ms mobile in these samples. The adapter is therefore not enabled by default.

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

- The root cause of the owner's reported 180–300 ms stalls is still unknown. The probe did record individual scene-pass image draws up to 5.3 ms and large post-canvas copies up to a few ms, but these are correlations in a software-rendered sample—not proof of the production-device bottleneck.
- No 60 FPS / 1% low target was demonstrated; the headless results are below 60 FPS and noisy.
- No real Android/iOS browser, high-refresh phone, physical touch latency, fullscreen/rotation cycle, Home-navigation return flow, long-session memory/GC trend, or multi-wave/boss session has been verified.
- Screenshots are point-in-time visual checks, not a full Gold UI acceptance or full-game video parity capture. They show VFX timing differences and must not be compared pixelwise as identical gameplay states.
- No itch.io release ZIP is designated ready while these acceptance gaps remain.

## Reproduction

The checked-in CI workflow builds the production preview, runs the render contract and deterministic parity tests, smoke-tests desktop and mobile wrapper/input behavior, and uploads separate off/on Chromium profiles and screenshots. It uses SwiftShader, so a green CI run still cannot satisfy physical-device acceptance.
