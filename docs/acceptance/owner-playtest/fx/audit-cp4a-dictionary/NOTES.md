# CP4a — Field Archive six decision-free fixes (2026-10-18)

All numbers measured in the live app (1366×768 + 932×430) before/after.
Bundled `src/` only — no runtime revision bump (none of these files are in
the revision lock). Files: `FieldArchiveC03.jsx`,
`FieldArchiveCombatReadout.jsx`, `fieldArchiveProfiles.js`,
`fieldArchiveC03.css`, `fieldArchiveC04.css`, `localeCatalog.js`.

## 1. Register page reset on page-2 pick
- Before: click SHURI on page 2 → list jumps to 01/02, chosen row
  NOT-IN-LIST (`resetFocus` forced `setPage(0)`).
- Fix: `resetFocus` sets the page that contains the target record within the
  filtered register; a focus-alignment effect keeps the focused record's
  page after pick-launch / async catalog load / search edits, without
  blocking free manual paging (`page` is not an effect dependency).
- After: pick SHURI → stays 02/02 with SHURI chosen; shift+1 wraps to
  NEWBOT on 01/02.

## 2. Thumbnail overflow (index rows + skin rows)
- Before: index img h=64 inside a 42px box (bleed 22px below the row);
  skin-thumb img h=74 inside 46px — percentage heights of grid items
  resolved against an indefinite grid area and fell back to intrinsic ratio.
- Fix: same absolute-fill pattern the ECO canvas already used
  (`position:absolute;inset:0;object-fit:contain`), parents get
  `position:relative;overflow:hidden`.
- After: 40/42px and 44/46px — contained at every viewport checked.

## 3. Half-clipped pager / navigation arrows
- Before: authored 34/30px buttons rendered 44px (legacy global
  `button{min-height:44px}` in `styles.css`), overflowing 40px bars at
  desktop and 28px bars at 932×430 by up to 16px.
- Fix: `min-height:0` on the archive's small-button rules (pager, record
  navigation, skin pager — spec-pages/skill-portraits already declared
  their own), and heights now `calc(100% - 6px/4px)` capped at the authored
  size so every media band self-fits.
- After: 34px in 40px bar (desktop), 22px in 28px bar (932×430).

## 4. Dev string in radar footer
- Before: `TACTICAL AFFINITY · mechanic-fields-v1 · NOT POWER / DPS`
  (weapon side printed `native-spec-v1`).
- Fix: footer no longer prints the internal `method` provenance field
  (kept in data). After: `TACTICAL AFFINITY · NOT POWER / DPS`.

## 5. Radar axis labels hardcoded Vietnamese in EN mode
- Cause: `PROFILE_AXES` labels were authored in Vietnamese while the
  localization system translates EN source copy → VI.
- Fix (system-level): labels authored in the source language
  (DAMAGE/CONTROL/MOBILITY/DEFENSE/FIELD, weapon TEMPO/REACH) + the seven
  VI pairs added to `localeCatalog` COPY. `localizationRuntime` translates
  the SVG text and bar labels like every other UI string — verified live:
  EN shows EN, switching to VIE shows
  SÁT THƯƠNG/KHỐNG CHẾ/CƠ ĐỘNG/PHÒNG VỆ/CHI PHỐI, back to ENG restores EN.

## 6. Skill metric line truncated + "COOLDOWN" printed twice
- Before: `COOLDOWN 10s · COOLDOWN 10 · DASH SPEED 3400 · …`
  (scrollWidth 461 > clientWidth 407, ellipsis-clipped). `skillRecords`
  fed every numeric config field into metrics — including `cooldown`
  itself, which the UI also prints as the dedicated `COOLDOWN Xs` prefix;
  `.fa4-skill-info small` was `white-space:nowrap`.
- Fix: cooldown fields excluded from the flat metric list; the line wraps
  instead of clipping. After: single `COOLDOWN 10s ·`, sw = cw = 407.

## Plus: center art sliding under the caption plate
- Before: art bottom 655 vs label top 627 (28px under the plate).
- Fix: `.fa3-hero-img` height reserves `max(13%,50px)` at the bottom.
  After: 20px clearance desktop, 15px at 932×430 (hover dips max +2px).

## Gates
- testFieldArchiveC04Profiles: PASS (hero 7 + weapon 42)
- testDictionaryRuntimeParity: PASS (28 mechanics)
- testCosmeticContracts: PASS
- testLocalizationGate: PASS (305 phrases, +7 axis pairs)
- testRuntimeRevisionGate: PASS (r12/66, untouched)
- testFieldArchiveC04Chrome: PASS (all viewports)
- testFieldArchivePickQuickChrome: PASS desktop + mobile
- testBoxeDictionaryArtChrome: PASS desktop + mobile-landscape
- testFieldArchiveC03Chrome: **pre-existing stale gate** — asserts
  `.fa3-combat-web-compact .fa3-web-node`, DOM from the replaced C03
  combat-web UI (only dead CSS remains). Fails identically on pre-CP4a code
  (verified by `git stash` A/B). Not rewritten inside CP4a scope; the C04
  Chrome gate covers the current readout. Recommend a separate tooling
  cleanup to retire/re-target it.

Shots: `A-desktop-skins.png` (1366×768), `B-932x430.png`.
