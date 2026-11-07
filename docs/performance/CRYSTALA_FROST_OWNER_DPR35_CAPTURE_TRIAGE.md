# On-device CRYSTALA versus FROST recording: performance triage

Date: 2026-11-07; user-submitted performance JSON 13:50:40 UTC.

## Actual captured facts

- Match: `CRYSTAL` vs `ICE` (FROST). 30,460ms, REC ON.
- Browser: devicePixelRatio **3.5**, phone viewport **432×768**.
- Native browser Region Capture returned a **824×1462** video, subsequently upscaled to **1080×1920** encoded H.264 at 22Mbps.
- rAF gaps: 504 observed over 30.46s, ~16.5 callbacks/s (NOT encoded-video FPS), median **58.2ms**, p95 **83.5ms**, max **408.4ms**.
- **recordingDrawMs**: 495 draws, median **6.1ms**, p95 **12ms**, mean **6.55ms**, aggregate 3.243 seconds of synchronous JavaScript timing. Previous owner BOXE vs FROST recording via manual crop at DPR 2.5 was ~0.6ms median / 1.2ms p95, BUT that was a different matchup and DPI; it is not a controlled same-machine A/B.
- CRYSTALA body + bloom profiling: p95 **3.2ms**; Frost ice render p95 **2ms**; Frost ice blit p95 **1.1ms**; Frost tick p95 **1.3ms**.
- These timers omit browser compositor, GPU queue and encoding pressure. No REC-OFF baseline was provided for this exact CRYSTAL/ICE trial. Do NOT claim these timings sum to whole-frame time, or that Region Capture alone caused every stutter.
- First/second/third chronological thirds of rAF samples averaged about 74.4/53.7/52.0ms, suggesting stronger load during the earlier spell-heavy phase.

## Concrete change in the single Draft performance branch

1. On **DPR 3.0 or higher**, choose the established exact viewport phone crop path instead of native Region Capture. This directly targets the user's slow native-crop case, keeps the same 1080×1920 final video and original tab audio, and does NOT touch hero rendering, VFX, animation, weapon sources or gameplay.
2. On other browsers that support native Region Capture, warm up nine real 1080×1920 `drawImage` operations at the original HIGH quality. If the **measured median exceeds 4ms**, ask Chrome to restore uncropped tab video *before the recorder starts* and use manual crop. Reject restoration failure rather than silently capturing the wrong rectangle.
3. On either route, compare real high-quality resampling against medium only if the selected path exceeds 4ms per draw; enable MEDIUM on the **encoded video only** if the device measures at least 20% lower processing time. All game canvases, Gold art, frame size, bitrate and sound remain unchanged; quality is HIGH otherwise. The selected mode and crop probe are written to owner PERF JSON.
4. Add focused unit assertions for route selection and quality guard; parse checked via V8 for the complete recorder module.

This is a **targeted change based on the owner's actual profile**, not a claim that other hero/skill GPU cost is fixed.

## QA / release blocker

The current branch cannot be rebuilt into a new verified itch ZIP because GitHub-hosted Actions jobs stop **before any runner step executes**, including an alternative ubuntu-slim runner, and this environment has no authenticated clone/assets or working full-game GPU test environment. The account-level runner allocation issue has not been confirmed as billing specifically.

Status: **SOURCE FIX COMMITTED; NOT YET QA-PASSED ON OWNER DEVICE; NO NEW DEPLOYABLE ZIP.** Never label an earlier RC5 release as this newer patch. Do not deploy an unverified asset to public itch.
