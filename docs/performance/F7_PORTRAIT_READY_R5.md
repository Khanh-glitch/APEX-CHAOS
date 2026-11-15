# F7 Portrait Studio readiness fix — R5

The reported “Khung 9:16 chưa sẵn sàng” is thrown by portraitFrameCrop,
before encoding: non-finite/zero dimensions AND negative frame coordinates
previously shared that message. The first recording paint immediately stopped
the recorder on failure. The studio cached even invalid measurements and did
not synchronously invalidate them when fit changed the transform.

The scaled 432x768 iframe also lived inside overflow:hidden containers, which
remain programmatically scrollable. Focus can move that container and displace
the on-screen crop even though scrollbars are hidden. CSS transforms retain
pre-transform overflow. This is a source-supported failure path; no reproduction
on the owner's machine is claimed.

Changes:

- Fix the studio body to the viewport; use overflow:clip on the host containers,
  with the prior hidden fallback. Preserve the sidebar's own scrolling.
- Refit/reset host scrolling when fresh geometry is requested. Invalidate crop
  synchronously with fit and never cache zero/off-tab/wrong-aspect measurements.
- After video startup and again after codec preparation, request fresh geometry
  and wait up to 1500ms for a valid source/crop before starting MediaRecorder.
- Prime the canvas with a valid frame before recording. During recording, retain
  the cached crop path; a failed crop gets one fresh refit before failing safely.
- Distinguish an off-tab crop from an unready frame. Bounds/aspect validation
  remains enforced; no guessed rectangle or desktop/sidebar content is admitted.
- Release temporary output tracks and video on failed startup, allowing retry
  without leaking media resources.

Quality is unchanged: real game viewport 432x768, output 1080x1920, 30 FPS target,
requested video 22 Mbps, original tab audio, same high-quality scaling. No combat,
HUD art, particle budget or R4 optimization is removed.

Source review and shipping build/package only. No automated tests, browser
playtests, benchmarks or GitHub Actions were run, per owner instruction.

References for browser behavior:
- https://www.w3.org/TR/css-transforms/#transform-rendering
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow
