# Free Battle retained runtime R1

Base: RC2 `cf978c02d7f24942d8a835b4286c97eb33c6c67f`.
Runtime revision: `20261114-retained-r1`.

This delivery removes redundant presentation work from the shared combat path.
It does not claim a measured FPS gain, pixel parity, or completion of a GPU/native
rewrite. No benchmark, browser playtest, automated test suite or GitHub Actions
was run for this delivery, as requested by the owner. Compilation and the existing
shipping packager's asset/path guards are part of producing the artifact.

## Implemented

1. **Coalesce combat HUD writes.** Damage and energy telemetry still update at
   the event boundary. The product renderer flushes HP, energy and recent-damage
   presentation after drawing each frame. Multiple hits no longer restart DOM
   synchronization independently. HP trails and burst pulses use Web Animations
   without `offsetWidth`; labels use `textContent` rather than layout-aware
   `innerText`. The existing reconciliation interval and lifecycle sync remain.
2. **Retain immutable geometry.** A shared weak cache stores crystal polygon
   paths; a bounded named cache stores SHURI ring ticks. Frost retains only
   fully grown, pre-thaw ice paths with matching pose/dimensions/pass parameters.
   Growth, cracks, thaw, clipping, layer order, alpha and material passes retain
   their authored code. Frost also reuses render-selection arrays.
3. **Share fluid work in production.** The existing guarded paired-advection
   implementation now serves Free Battle BOXE, including its flurry engine.
   Repeated smoke raster arithmetic is reused within the same render pass.
   Both optical smoke layers and both image uploads remain. An unrecognized
   solver uses its original advection implementation. There is no grid-size,
   iteration-count, particle-count or output-resolution reduction.
4. **Bound presentation update/lifetime work.** BOXE and SHURI advance through
   an actor preparation boundary, guarded by render frame and simulation clock.
   Preparation remains immediately before the same actor's drawing to preserve
   random-consumption order. BOXE uses stable array compaction and releases
   replaced flurry engines and match engines. This is a preparation seam, not
   a worker implementation or independent simulation scheduler.
5. **Remove always-on diagnostic allocation and ship consistent assets.** Frost
   integrity trace is opt-in via `APEX_FROST_PRESENTATION.setIntegrityTraceEnabled`
   (see the exported runtime API); normal drawing retains its state isolation.
   Revision URLs, source hashes and Gold hashes are updated together. LF checkout
   attributes keep byte receipts reproducible across platforms. The Frost bridge
   also reapplies its retained presentation edits when regenerated.

## Deliberately preserved and outstanding

- Collision, damage, hitbox, cooldown, source sprite art, resolution and authored
  animation timesteps are unchanged by these edits.
- The RC2/F7 recorder implementation is unchanged. This delivery does not repeat
  the reverted requestVideoFrameCallback/clear-removal recording experiment.
- It does not reintroduce the reverted Crystala bloom surface pool/bucket change.
- Worker transfer, complete simulation/render separation, a unified GPU renderer
  and a native port remain unimplemented architecture tiers. They are alternatives
  with different deployment and compatibility costs, not claims of this ZIP.
- Path2D caches and timing-preserving batching require the owner's visual/gameplay
  acceptance. Source inspection establishes what repeated work was removed; it
  does not establish the frame time of the owner's hardware or F7 encoding path.

## Build without tests

Install locked dependencies in the root and the two isolated UI projects, then:

```sh
pnpm run build:itch:retained
```

This builds the account/mission and result UI, materializes audio build inputs,
classifies shipping assets, compiles Vite with a relative base, prunes nonshipping
files, writes the Git receipt and runs the existing itch portability packager.
Archive the **contents** of `dist-itch-html5`, with `index.html` at the ZIP root.
Do not upload a source ZIP or a ZIP containing an extra enclosing directory.

The canonical receipt describes the pre-portability build. The portable copy
rewrites local URLs as required by itch's nested hosting; the supplied archive
SHA-256 identifies the final upload artifact. Git remains local until explicitly
published; this build command never pushes or starts GitHub Actions.
