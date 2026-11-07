# BOXE vs FROST owner-device recording profile — diagnostic build

This diagnostic ZIP is **not a performance fix** and must not replace public APEX CHAOS r5. It derives from the RC2 audio-only baseline, leaving original Frost/BOXE art, combat behavior, sound assets, game render resolution, r5 recording frame-loop, codec priority and 22 Mbps / 1080×1920 recording intact.

## One test — on the laptop that actually stutters

1. Upload the diagnostic ZIP to a **separate private/Draft** itch HTML5 page. Do not update the live game. Or host the extracted ZIP from HTTP(S); Chrome's tab capture is not guaranteed under file://.
2. Open its Portrait Studio as a top-level Chrome/Edge tab. Enter BOT Battle and select **BOXE P1 vs FROST P2** (FROST's internal fighter ID is `ICE`). Use the same display size/browser configuration as your failed r5/RC2 recording.
3. Press **REC**, choose **This Tab** and enable **Share tab audio**. Record **15–30 seconds**, including the Frost ice skill that triggers lag; then STOP.
4. Click the new **⬇ PERF JSON · sau khi quay** button. If needed, focus the game and press Shift+Ctrl+F6 to download again.
5. Share the small `.json` file and, if convenient, the original recorded video. Do not share a screen-capture of personal windows; the report records only game hero IDs, capture dimensions/bitrate, aggregate time samples and viewport/DPR. No source code, account secrets or mic audio are embedded in the JSON.

## Interpretation and limits

The report exports:
- `rafGapMs` — game iframe's requestAnimationFrame callback intervals; a proxy for UI scheduling **not measured MediaRecorder output FPS**.
- `frostIceClearMs` — time clearing Frost's offscreen 1000×1000 ice layer.
- `frostIceRenderMs` — time producing the Gold ice union on the offscreen layer.
- `frostIceBlitMs` — time copying that layer into the world canvas at alpha 0.97.
- `recordingDrawMs` — time to crop/scale the actual selected tab frame into the 1080×1920 output.
- `longTaskMs` — browser main-thread Long Task API durations where supported.

A valid run should show `matchup: ["BOXE","ICE"]`, `meta.targetResolution:[1080,1920]` and at least 10 seconds of samples. These metrics cannot isolate GPU queue wait or hardware video encoder time; when ambiguity remains, collect a Chrome GPU trace as a next step rather than guessing.

## Safeguards

- Game is unchanged until recording begins; the profiler then only calls `performance.now()`, observes animation-frame/Long Task timings, and stores bounded arrays (9000 values/series).
- Gold renderer's original `drawImage(e.iceCanvas,0,0)` remains exactly intact.
- FPS, visuals, skill timing, gameplay, audio asset routes, recording codec order and video bitrate are not changed.
- The JSON is exported **only when the owner asks**; no telemetry is transmitted to servers or third parties.
- CI Chrome tests check actual video dimensions, audio-track presence and the JSON-report schema. Chrome CI uses a software GPU; owner hardware acceptance remains mandatory.

**Next decision:** use the owner trace to compare ice-blit and recording-draw costs. Fix the measured hotspot on a new branch, require no image degradation and owner A/B approval before marking lag resolved.
