# CP2 — BOT WAVE card → glowing BOXE emblem (2026-10-18)

Owner decision (custom): drop the current card form; small icon = BOXE
standing cutout with glow, placed somewhere distinctive, plus "BOT WAVE"
text. Gold's six Home buttons untouched (R8 law). No runtime revision bump:
only bundled CSS changed (`src/game/botWave/wavePreviewEntry.css`); markup,
launch behavior and scene-visibility rules unchanged.

## What changed
- The 292–370px gradient card (border, clip-path, scanlines, 38/62 grid) is
  gone. The entry is now a transparent vertical emblem: the BOXE standing
  cutout (`/assets/dictionary/heroes/boxe/standing.png`, verified alpha:
  corners 0, ink 54.4% of 1086×1448) with layered orange/red `drop-shadow`
  glow, a soft radial aura behind it, a ground shadow under its feet, and
  SPECIAL EVENT + BOT WAVE + BOXE/ARSENAL SURVIVAL microcopy beneath with a
  soft dark scrim (not a panel) for legibility over bright armor art.
- Placement ("somewhere distinctive", measured — not eyeballed):
  - Desktop/landscape: right-edge event beacon, vertically mid-stage.
  - Short landscape (≤980px): smaller emblem, subline hidden.
  - Portrait: right side below the ARCHIVE chip, standing over the robot's
    claw line, clear of the title and the whole CTA stack.
- Hover lifts and intensifies the glow; focus outline, disabled state,
  reduced-motion, scene hide rules (mode/fighter/story/lucky/not-ready)
  and the wave `#return` styling are unchanged.

## Measured proof (rects, overlap area vs entry)
- 1366×768: entry 1190,264–1333,471; overlap FREE BATTLE 0 / CONTINUE 0 /
  ARCHIVE 0. (`B-after-1366.png`)
- 390×844: entry 279,165–382,334; all overlaps 0. Before: the card covered
  FREE BATTLE (`A-before-card-390.png`). (`C-after-390.png`)
- 932×430: entry 808,154–922,283; all overlaps 0. (`D-after-932.png`)
- 768×1024: entry 634,198–760,371; all overlaps 0. (`E-after-768.png`)
- Functional: clicking the emblem mounts `#apex-wave-host` and sets
  `apex-bot-wave-active` (`F-wave-launched.png`).

## Gates
- testBotWaveGameRouteR5: exit 0
- testBoxeModeEntryChrome: exit 0 (needs app on :4173; provided ad hoc)
- (Generated gate output `docs/boxe/r5-browser/` intentionally not committed.)
