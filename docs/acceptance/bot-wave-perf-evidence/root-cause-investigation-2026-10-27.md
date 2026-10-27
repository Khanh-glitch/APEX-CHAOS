# BOT WAVE lag — status and hardware blocker (2026-10-27)

## Decision

**NOT READY. The lag is not fixed.** The refraction-copy experiment and its app-side diagnostics have been reverted from `public/bot-wave/game.html`, which now matches the PR base. Three same-host SwiftShader A/B pairs produced no stable gain, so the failed renderer experiment, candidate-only tests and repetitive A/B jobs were removed. No visual-quality or gameplay reduction was used.

## Exact blocker

This execution environment cannot produce the evidence needed to choose a product rendering optimization:

- `/dev/dri` is absent; no `nvidia-smi`, system Chrome or Chromium is installed.
- The only bundled Chromium is software-backed. It reports `ANGLE_SWIFTSHADER` / `SwiftShader Device (Subzero)`.
- A local attempt to run the Localization Chrome test with the bundled binary failed before browser startup: `libnspr4.so: cannot open shared object file`.
- Therefore there is no hardware-accelerated Chrome trace, physical GPU timing, or real-device input-latency result from this sandbox. Do not infer the production bottleneck from those SwiftShader stalls.

The owner-run capture is prepared in `tools/profileBotWaveHardware.mjs`; details and exact Windows/Android commands are in [`README.md`](README.md). It refuses known software renderers and disabled GPU compositing, preserves native display resolution/DPR, uses the actual Gold wrapper and existing Canvas2D pipeline, exercises 14 campaign-described bots/six existing skills with simultaneous wave/heat effects, captures five minutes by default, and writes:

- Chrome Performance trace with GPU/Viz/raster/compositor and scheduling events;
- reported adapter, driver/backend and GPU feature status;
- RAF interval percentiles, FPS estimate and 1% low;
- trusted DOM input-to-next-RAF latency, Long Tasks and CDP task/script/layout metrics;
- periodic heap/game-state samples and start/end screenshots;
- optional V8 CPU profile.

**Owner data needed:** `*.summary.json`, matching `*.trace.json`, start/end screenshots, GPU make/model/driver, Chrome version, OS/device model, native resolution/DPR/refresh mode, and the movement/skill sequence during the capture. For a mobile result, run on the real Android Chrome device over USB/CDP or provide a device-side trace. One capture is for classification; only after it identifies a plausible cost center should a specific lossless renderer change be tested before/after on that same device.

## What code inspection establishes (not a measured root cause)

The original Gold post renderer uses a full-DPR scene canvas and refraction-copy canvas, plus quarter-resolution bloom, chroma and radial surfaces. On active shock/heat frames it copies the scene into the refraction canvas, then samples that copy for shock and heat passes; it also downsamples/composites bloom and conditionally applies RGB split/radial work. This identifies measurable questions for the hardware trace—Canvas2D draw/clear/snapshot cost, raster/compositor queueing, texture/resource uploads, and main-thread scheduling—but does not say which one dominates on the owner device.

The previous region-copy optimization reduced pixels copied in the software benchmark but did not improve paired frame/input P95/P99. It is now removed. I did not replace it with OffscreenCanvas, WebGL/WebGPU, cached layers, or another speculative pipeline: none can be justified without a hardware trace and pixel/interaction parity proof. The exact historical candidate CI assertion remains unknown because its uploaded failure artifact/log could not be downloaded from this sandbox (EOF); the later candidate runs passed intermittently. The new workflow no longer treats candidate performance as a gate.

## Separate CI findings

- BOT WAVE run `40505086078` passed on the pre-rollback code, but it still included the candidate profile. The simplified compatibility-only workflow has not yet run post-rollback. A green SwiftShader compatibility result will mean only that the Gold wrapper/control path loads and accepts emulated input.
- Localization run `40505086104` failed at “Verify real Chrome desktop and portrait glyphs” after 21 seconds; GitHub lists no artifact and the raw job log is unavailable here. The script's CDP startup loop is exactly 20 seconds, making Chrome process/CDP startup the leading hypothesis rather than a glyph assertion. A local attempt with the bundled Chromium failed at the same startup stage because `libnspr4.so` is missing. This is a separate localization test harness issue; do not edit locale code without confirmation. Rerun with system Chrome while capturing child stderr/exit status or add a focused startup diagnostic before changing visual expectations.
- Product Acceptance continues to fail the inherited runtime-revision gate on five Shuri files verified unchanged from the PR base. Those files are out of scope; do not modify them or loosen that gate in this PR.

## Visual/gameplay scope

The wrapper Home control remains bottom-centered so it does not cover the centered wave title. Previously captured desktop and mobile-landscape wrapper entry/combat screenshots were inspected; the Gold HUD, onboarding, Home control and lower-left mobile joystick remain. The game renderer itself has been restored to the PR base. There is no claim of acceptable latency, no hardware/mobile acceptance, and no release ZIP.
