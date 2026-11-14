# Shared runtime work R4 — 2026-11-15

## Scope and evidence

Source-based causal review of the shared production path, including the actual
Gold HUD embedded in the shipping shell. No device benchmark, browser playtest,
automated tests or GitHub Actions were run, as requested. Build and packaging
are the only executed application pipeline. The findings establish unnecessary
work in code, not its measured share of frame time on any particular device.

R4 fixes shared execution/lifecycle problems rather than adding Safari detection.
It includes the R1 retained render improvements, R2 recording changes, and R3
Gold component/layout ownership fixes. Those earlier changes alone did not
address the shared work documented below.

## Five shared causes and corrections

1. **The battle renderer continued behind menus after a match.**
   `apexEngine.loop` always called `draw` and scheduled another RAF. Both engine
   menu routes and `exitArsenalBattleMode` changed the state without cancelling
   that loop. `update` returning early did not prevent `draw` from clearing the
   canvas, drawing the arena and retained fighters. R4 releases the frame lease
   at every existing exit and guards MENU/SELECT before and after update. Match
   entries already set `lastTime` and reacquire RAF. This explains unnecessary
   menu load **after entering a match**, not first-boot menu stutter by itself.

2. **Static Gold identity was reconstructed on every projection.**
   `pump -> applyState -> applyIdentityProjection` replaced both side-art SVG
   subtrees every frame. Skill/name/description writers compared English source
   against translated DOM, allowing repeated translation/replacement. R4 retains
   identity and skill source values, changes SVG only when its motif changes,
   and avoids unchanged quest/round/kind attribute writes. The visible SVG,
   typography, images, and live skill/HP values are retained.

3. **Presentation code forced layout while updating HUD.**
   `renderSkills` interleaved card writes with `clientWidth` reads, every frame.
   Card widths now come from a size observer, outside the frame renderer.
   Portrait Local damage/heal feeds removed and re-added `pulse` around an
   `offsetWidth` read even though `pulse` only controls visibility. R4 keeps the
   visibility class and the authored Web Animation without that forced reflow.
   Actual effect geometry and responsive layout remain intact.

4. **Work did not have a complete owner/lifetime.**
   The donor and bridge each scheduled HUD work separately. The bridge now
   applies state, synchronizes fighters and ticks the hosted HUD in one callback;
   standalone HUD still has its own loop. Teardown releases resize/message
   listeners, size observers, scheduled effects, feed/hit timers and animations.
   Old HUD instances no longer retain those callbacks across rematches. The
   thunder canvas clears only while active or needing its final clear, instead
   of touching a full-viewport surface every idle frame. Lightning is unchanged.

5. **Shared services processed their own/repeated presentation output.**
   The localization observer had no unchanged-text/language fast path, and the
   translator repeated its matching pipeline for identical canvas/DOM copy.
   R4 tracks last output plus language and caches at most 2048 short translations.
   A language change still walks/updates live UI. Fracture clones are frozen
   copies of already-localized UI and are excluded from retranslation. Continuous
   frame sampling and the long-task observer are now opt-in (`?apexPerf=1` or
   `window.__APEX_PERF_ENABLED` before module evaluation), instead of always
   running from menu onward. Boot/resource timing receipts remain available.

## Shipping consistency and visual contract

`optimizeGoldHudRuntime.mjs` is an idempotent, guarded build transformation applied
to both the canonical standalone donor and embedded shell donor. It refuses
unrecognized source changes instead of silently omitting a fix. The Gold component
compiler emits the resulting payload and scoped CSS; the canonical cutover
generator uses the same transformation. Runtime revision and shipping manifests
are refreshed for this release.

No texture/asset is downscaled. No combat VFX pass, particle count, render cadence,
arena buffer size, audio layer, or gameplay rule is reduced. F7 settings remain
1080x1920, target 30 FPS, requested 22 Mbps. R4 removes shared main-thread work;
it does not claim to remove the browser's tab-capture, copy or encoding cost.
The browser may still miss frames while recording, and CSS/GPU effects may remain
expensive on older devices. No claim of universally smooth performance is made
without the owner's device acceptance.

First-boot cold loading/decoding and GPU/compositor cost are **not established as
resolved by this patch**. Their contribution cannot be inferred from the code
findings above. Earlier suspension of Home particles/animations during battle
already existed and is not represented as a new R4 fix.

## Technical references

- Read/write layout ordering: https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing
- Observer lifetime: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect
- Animation ownership: https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations

These explain browser mechanisms; the application-specific causes above come
from the repository's call paths. The release receipt records the actual commit,
ZIP SHA-256 and build status. Source review/build are not runtime test results.
