# BOXE vs FROST — same-device A/B frame-timing investigation (2026-11-07)

## Scope
Diagnostic only. This branch extends the original owner-device performance trace branch. It must NOT be promoted as a recording performance fix or published in place of public r5. The video compositor, MediaRecorder codec priority, FPS target, image quality, Gold ice renderer, and game/audio simulation remain unchanged.

The owner's 90.3-second captured trace has matchup `["BOXE","ICE"]`, RAF gap median 50.1 ms, p95 66.9 ms, maximum 316.9 ms, while recorded Frost ice blit p95 was only 1.7 ms and recording draw p95 1.1 ms. These JavaScript timings do **not** establish hardware compositor/encoder cost or encoded-video FPS.

## On-device test
1. Use a separate **private** HTML5/HTTPS test build of this branch, not the public itch release. Enter Portrait Studio at 432×768, and BOT Battle with BOXE (P1) vs FROST/ICE (P2).
2. With **REC OFF**, focus the game, press **Shift+Ctrl+F5**. Play normally for 20 seconds. The probe stops automatically; press **Shift+Ctrl+F6** to download its JSON. It records `meta.captureMode: "recording-off"`.
3. Keep device, scene, browser, graphics, opponent, background applications and battle complexity as similar as possible. Record the same matchup with **REC ON** (Shift+Ctrl+F7 or studio REC, select **This Tab**) for 20 seconds. Stop and press **Shift+Ctrl+F6** again. This JSON records `meta.captureMode: "recording-on"`.
4. Send both JSON files and ideally the encoded video. The recording-on trace does not measure encoded-video FPS. If the RAF-gap difference is substantial, capture a Chrome Performance trace with GPU/compositor and media encoder events to establish root cause.
5. Repeat A/B alternating the order for at least two pairs; battle phases and natural movement introduce noise. Do not interpret a single test as proof.

## Operational safeguards
- **Shift+Ctrl+F5** toggles a bounded, 20-second baseline only when there is an active BOT battle and no recording in the Portrait Studio. **Shift+Ctrl+F6** downloads the latest completed report. The preexisting **Shift+Ctrl+F7** recording behavior is retained.
- Before recording starts, an unfinished baseline is stopped. Exiting battle stops the baseline.
- Diagnostic callbacks only observe frame intervals and the existing Frost section timing hooks. The in-game graphics/render implementation is untouched.
- The report format remains `APEX-CHAOS-owner-recording-perf-v1`, with an additional optional `meta.captureMode`; existing diagnostic consumers may ignore this field.

## Acceptance
No performance-fix claim until before/after hardware measurements, image fidelity, audio parity, playable battle, and actual encoded recording are checked. Do not merge failed experimental Frost blit PR #123 or overwrite the public r5 release.
