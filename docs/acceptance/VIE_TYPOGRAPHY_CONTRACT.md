# APEX CHAOS · VIE Typography Contract (R59+)

## Why the first localization passed but lost text
This is a regression prevention contract derived from Chromium metrics on `main` at `f4d9de6`.

- The original Gold uses condensed display faces (Impact/Bahnschrift, Oswald, Teko) and fixed, clipped UI composition.
- A broad VIE rule silently replaced these with **wide Arial** in main Gold and with `!important` in same-origin iframes. The result: `ĐẤU VỚI MÁY` in Mode Select needed **410px** inside **326px** on desktop and **238px** inside **183px** in portrait, with actual clipping.
- The old Chrome smoke asserted HOME headline and button geometry, not every Gold surface.
- `public/gold/fonts.css` only carries Latin and Latin-ext subsets and does not guarantee Vietnamese diacritics.

## Typography hierarchy / immutable design
1. Preserve ENG Gold metrics and family declarations unchanged.
2. VIE Gold uses an OSWALD variable face with full Vietnamese coverage vendored into `public/gold/fonts/apex-oswald-vietnamese.ttf`. Pinned source blob `d1a3b9cb1325bf20b3a06ef9849d21c411212a3b`, SIL OFL license shipped alongside.
3. Declare font roles (`--fDisplay`, `--fAction`, `--fUi`, frame-local `--fd`, `--fui`, `--fnum`), **not a global `font-family: ...!important` across every DOM node**. Keep native Result Gold's Vietnamese typographic system intact.
4. Decorative clipping, game FX, real world artwork and weapon/hero names may not be altered to fit copy.
5. Gold combat logic, V4.3 Arsenal authority and Quest canonical script remain untouched.

## Content-fit policy
| Role | Behavior | Forbidden fallback |
|---|---|---|
| HERO/section headline | Retain Gold composition, line breaks and accents | Per-string transform X scaling |
| Primary button or mode option | Short, deliberate Vietnamese copy with visual verification | Ellipsis; silent overflow |
| Fighter / weapon / skill | Keep original identities, permit approved descriptive wraps only in eligible areas | Truncating gameplay-critical information |
| Secondary subtitles | Fit with existing role-based spacing or semantic shorter wording | Globally shrinking font-size |
| Data numerals, cooldowns | Exact authoritative numeric content | Cropping or abbreviating values |
| Quest dialogue / Result Gold | Naturally wrap within caption-safe areas | Rewriting story/award rules to manipulate layout |

## Automated acceptance (both languages)
- At minimum audit desktop 1440×900 and portrait 390×844; add narrow portrait 360×640, small landscape 844×390, and larger desktop.
- Wait for `document.fonts.ready`, then inspect **actual text Range client rectangles** against clipping ancestors. `scrollWidth` alone is insufficient because decorative pseudo elements inflate it; visibly off-screen drawers and screen-reader-only content must not count as visible clipping.
- Fail a release if a visible primary action or mode title is clipped, if a necessary button hit target is occluded, or if glyph fonts are not loaded from shipping assets.
- Test HOME, Mode Select, all roster hero selections, Fight/Battle HUD, Lucky Draw including open drawer, Quest captions, Results and all archive modals. Tests of only HOME or only English translation are *not* typography acceptance.
- Verify locale switch VIE→ENG→VIE restores text without mutating IDs, authority or gameplay state.
- For shipping, confirm `dist/gold/fonts/apex-oswald-vietnamese.ttf` exists after prune and matches the pinned blob. CI passing on `vite dev` alone does not guarantee production delivery.

## Failure triage
Log original text, DOM role, locale, viewport, loaded font, font weight, text width, available width, clipping ancestor, and a screenshot. Classify as font/glyph failure, translation-length failure, layout contract issue, or false-positive decorative mask. Fix at role/layout policy or curated translation key; **never accumulate selector-specific overrides simply to make one screenshot pass**.

## Release boundary
Do not merge the foundational font change until the VIE and ENG browser suites and Arsenal Product Acceptance are green on the exact PR HEAD. Physical mobile Safari and 3rd-party hosting remain separate acceptance surfaces.
