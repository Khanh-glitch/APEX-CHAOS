# BOT WAVE lag investigation — hardware capture required

**Status: NOT READY.** The refraction-copy experiment has been removed from the game. Three paired SwiftShader stress runs had already shown no stable latency improvement, so the region-copy path, its A/B gate, and its candidate-specific tests were reverted. The approved Gold game renderer is restored byte-for-byte from the PR base; no DPR, resolution, effects, bot count, gameplay speed, or visual quality was reduced. There is no demonstrated product performance fix.

## Verified scope

- `public/bot-wave/game.html` matches the PR base again. The failed refraction-copy and diagnostic wrappers are not shipped.
- The wrapper's Home control remains bottom-centered rather than overlapping the wave title. Desktop and mobile-landscape wrapper entry/combat screenshots were visually reviewed; Gold HUD, Home navigation, onboarding, and joystick remain present.
- CI has been changed to treat headless SwiftShader as **compatibility QA only**: build and wrapper/input smoke. It no longer runs performance A/B or draws product conclusions from SwiftShader. The post-rollback workflow result is pending the next push; prior green runs were before the candidate was removed.
- No release ZIP was made. PR #110 remains draft.

## Environment blocker — exact

This sandbox has no `/dev/dri`, no installed system Chrome/Chromium, and no `nvidia-smi`/GPU adapter access. The only bundled Chromium is the software-rendered `@sparticuz/chromium`; attempting the Localization Chrome repro with it failed before the test because `libnspr4.so` is absent. The saved SwiftShader trace reports `ANGLE_SWIFTSHADER` / `SwiftShader Device (Subzero)` and is **not** a physical GPU or mobile result.

The previous real-hardware bottleneck cannot be honestly classified as CPU, raster, GPU execution, texture upload, or frame scheduling until an owner capture is available. Historical SwiftShader traces showed GPU/raster stalls, but those are not accepted as the product root cause. Chrome's GPU/Viz trace task durations are queue/service timings, not per-shader hardware timer queries; vendor GPU tools may be needed if the Chrome trace leaves GPU execution ambiguous.

## Owner-run hardware profile

`tools/profileBotWaveHardware.mjs` launches installed Chrome visibly or connects to an existing desktop/Android Chrome through CDP. It **hard-fails** if Chrome reports SwiftShader, llvmpipe, software rasterization, or disabled GPU compositing. It does not force a backend, lower quality, resize the native display, or use the bundled Chromium.

On the owner desktop, from the repository root:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm exec vite preview --host 0.0.0.0 --port 4173
```

In a second PowerShell window:

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:APEX_APP_URL = 'http://127.0.0.1:4173'
$env:APEX_PROFILE_DURATION_MS = '300000'
$env:APEX_PROFILE_BOTS = '14'
corepack pnpm profile:bot-wave:hardware
```

Keep the visible Chrome window foreground. The profiler starts the authentic Gold route, prepares 14 campaign-described bots and the existing ability set, replenishes the controlled bot load with campaign descriptors, then schedules simultaneous native wave/heat effects. This synthetic replenishment is confined to the profiling page; it does not change shipped gameplay. During the five-minute capture, play normally and use the real keyboard/touch controls. It records the raw Chrome trace, GPU adapter/features, compositor/raster/GPU events, RAF frame intervals/FPS and 1% low, trusted input-to-next-RAF latency, Long Tasks, periodic JS heap/game-state samples, screenshots, and optional V8 CPU profile (`$env:APEX_CAPTURE_CPU_PROFILE='1'`). Reports go to the ignored `reports/bot-wave-hardware/` directory; do not commit raw traces.

For Android Chrome over USB, serve the preview on the host LAN and use the host address from the phone. With Android debugging enabled, forward Chrome's DevTools socket:

```powershell
adb forward tcp:9222 localabstract:chrome_devtools_remote
$env:APEX_CHROME_REMOTE = 'http://127.0.0.1:9222'
$env:APEX_APP_URL = 'http://<HOST-LAN-IP>:4173'
$env:APEX_PROFILE_DURATION_MS = '300000'
corepack pnpm profile:bot-wave:hardware
```

Required owner evidence to proceed: (1) the `.summary.json`, (2) matching raw `.trace.json`, (3) start/end screenshots, (4) GPU/driver and Chrome version from the summary, and (5) device model, OS, display mode/resolution/DPR and the exact movement/skill sequence during the run. For any before/after comparison, use the same physical device, Chrome version, display mode, campaign state, bot/skill/effect schedule, and duration. One capture is for root-cause classification; repeat only after identifying a specific candidate change to test.

**Metric limits:** RAF gaps are app scheduling/render-cadence measurements, not a photodiode measurement of input-to-photon latency. Input latency here is trusted DOM event to next RAF. GPU trace task times do not equal GPU shader execution time. The tool preserves these distinctions in its report.

## CI separation and unrelated gates

- The prior BOT WAVE candidate CI failure was intermittent. The latest hardware-agnostic compatibility run passed after candidate removal; no GPU-performance claim is attached to it. A historical candidate failure artifact exists, but its exact assertion was not readable in this sandbox because GitHub's artifact/log endpoint returned EOF.
- Localization run `40505086104` failed at **“Verify real Chrome desktop and portrait glyphs”** after 21 seconds; the run lists no artifact. The script polls for Chrome CDP for exactly 20 seconds, so startup failure is the leading hypothesis, not a glyph-layout regression. I could not inspect the raw CI log to confirm it. A local attempt with bundled Chrome failed at that same startup stage because `libnspr4.so` is missing. Do not change locale code based on this; confirm with system-Chrome stderr/exit-code diagnostics or rerun the workflow on a Chrome-equipped host.
- Product Acceptance remains red on the inherited runtime-revision gate for five Shuri files unchanged from the PR base. Those files are out of scope and must not be edited or the gate relaxed in this PR.

## Existing visual captures

- [Mobile wrapper entry/onboarding](screenshots/mobile-wrapper-entry.png)
- [Mobile landscape wrapper combat and touch control](screenshots/mobile-wrapper-combat.png)
- [Desktop wrapper combat](screenshots/desktop-wrapper-combat.png)
