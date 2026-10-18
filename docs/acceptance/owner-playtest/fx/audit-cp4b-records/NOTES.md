# CP4b — Fill the six locked dossiers + stat deduplication (2026-10-18)

## Records 8/14 → 14/14
- The register now catalogues `PRODUCT_ROSTER.visibleIds` (the product
  authority's full visible roster) instead of only `playableIds`.
- BLACK_HOLE, MATH_V2, RUBBER, TIME, SLIME, SNIPER already have full
  canonical mechanics in `heroRegistry.js`, so their profiles and skills
  derive from real gameplay data through the existing rules — no fabricated
  numbers. Verified live: BLACK HOLE derives DAMAGE 42 / CONTROL 0 /
  MOBILITY 11 / DEFENSE 19 / FIELD 8 with skills EVENT HORIZON, TRANSIT
  (CD 14s), DAMAGE SINGULARITY; MATH V2 derives MULTIPLY DIVIDE,
  PARABOLA GRAPH, DAMAGE EQUATION.
- Locked presentation (honest, no fake art): register rows show a monogram
  (BH/MV/R/T/S/S) + `LOCKED FILE`; the record navigation reads
  `LOCKED ROSTER`; the artwork panel reads `VISUAL RECORD CLASSIFIED —
  Fighter locked, dossier incomplete`; skill chips use the existing
  P/A1/A2 letter fallback. `EQUIP` stays safely on the ORIGINAL variant
  (cosmetic authority always provides one).
- Names no longer print raw IDs (`BLACK_HOLE` → `BLACK HOLE`), and derived
  skill names use the mechanic segment of the namespaced ID
  (`black_hole.event_horizon` → `EVENT HORIZON`); the previous first-word
  strip produced `HOLE TRANSIT`. Playable names verified unchanged
  (NEWBOT: DAMAGE MILESTONES / WEAPON DASH / VIRTUAL ARMOR).
- When these fighters eventually unlock + get approved art, they become
  `PLAYABLE` in `productSurface.js` and every surface here follows with no
  further Archive edits (same system law as CP3's ink standard).
- Note: pick shows `MATH MK.II` (Gold presentation name) while the Archive
  shows the registry prettified `MATH V2`. Left as-is: the registry is the
  Archive's naming source; unifying display names belongs in the registry
  (`displayName`), not in Archive code.

## Stat deduplication (was: five axes ×3 forms)
- `Profile` now takes a `form`: SKINS (compact embed) renders **bars only**;
  INFO renders **radar only** (INFO keeps its skill detail / weapon
  telemetry). Heroes and weapons follow the same law.
- CSS: each form owns the full profile width when alone (radar no longer
  52% at ≤900px; bars keep the 5-column grid instead of collapsing to a
  48% side column).
- Measured live: SKINS bars=5 radar=absent; INFO bars=0 radar=present,
  for heroes and weapons. A 0 axis stays honest in both forms (bar `0`,
  radar vertex at centre) — the pair now complements instead of repeating.

## Gate updated to the new law (not weakened)
`testFieldArchiveC04Chrome` previously pinned the duplicated layout
(compact radar + INFO bars). Rewritten to assert: compact has 5 bars and
NO radar; register shows `14 FILES`; INFO has the radar and NO bars; the
RPG-7 five-axis check now reads the radar's `aria-label` values.
All other assertions untouched.

## Gates
- testFieldArchiveC04Profiles: PASS
- testDictionaryRuntimeParity: PASS (28 mechanics)
- testCosmeticContracts: PASS
- testRuntimeRevisionGate: PASS (r12/66, untouched — bundled src only)
- testFieldArchiveC04Chrome (updated): PASS all viewports
- testFieldArchivePickQuickChrome: PASS
- testBoxeDictionaryArtChrome: PASS (its hardcoded 7-hero walk is
  unaffected: the six records append after SHURI)

Shots: `A-blackhole-info.png` (radar-only INFO), `B-blackhole-skins.png`
(bars-only SKINS, classified dossier).
