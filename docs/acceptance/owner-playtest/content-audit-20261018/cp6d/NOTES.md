# CP6d — Archive clarity, feature labels, locked feedback (r17)

Owner scope: CP6 `full`; D4 chose hand-curated Archive metrics. This final CP6
checkpoint changes presentation/data only. It does not alter R91, the owner
Gold library, Battle HUD composition, weapon identities, Story availability,
or Result packaging.

## Curated skill specs

- `fieldArchiveProfiles.js` no longer flattens the first five numeric config
  keys. `SKILL_SPECS` maps 41 registered `mechanicId`s to two or three
  player-readable stats while still reading the Lv1 values from the canonical
  registry config. TIME's passive has no numeric gameplay config and uses the
  `ALWAYS ACTIVE` fallback; unknown future mechanics fall back to cooldown
  only rather than raw key names.
- Examples:
  - MAGNET A1: `COOLDOWN 11s · FIELD 1s · PULL RANGE 700u · GUN SPEED CAP 900u/s`
  - FROST passive: `FREEZE CHANCE 8% · FREEZE 0.9s · RE-FREEZE LOCK 0.5s`
  - BOXE A1: `COOLDOWN 15s · FLIGHT UP TO 5s · IMPACT STUN 0.35s · FLURRY HITS 24`
- A full 42-skill print was reviewed before shipping. Two semantic risks were
  corrected at the map source: MATH now uses the real `xFactor` (`MULTIPLY ×2`),
  and MIRROR no longer presents presentation `timeScale` as a gameplay speed.
- The radar axis `FIELD` became `FIELD CONTROL`; no radar scores or balance
  meanings were changed.

## Archive text and density

- BOXE and SHURI skill descriptions were shortened to fit the Archive's
  two-line frame; numeric detail moved into the curated spec line. All six new
  descriptions received Vietnamese pairs.
- Locked fighters without an authored intro now read
  `Fighter locked — dossier incomplete.` instead of repeated manual-like
  boilerplate.
- Redundant micro-labels were trimmed without changing layout: index headers,
  document/record duplication, stamps, repeated `FIGHTER`, detail headings,
  readout tops, art status, roster navigation, search placeholder, and footer.
- The repeated weapon-skin sentence became the tier legend using the real
  drop roll: `T1 29% · T2 29% · T3 23% · T4 12% · T5 5% · T6 2%`.

## Feature naming and locked feedback

- The visible Gold dock route is now `Archive` through cutover patch
  `SHL-S61`; the internal `#apexDictionaryOpen` seam remains unchanged.
- Pick's Archive entry and the Archive headings now consistently say `SKINS`.
- Quest replay taxonomy now says `ENCOUNTERS / REPLAY` under the existing
  `CHAPTER 01 / 11` progress line.
- BOT WAVE uses the single subtitle `BOXE / ARSENAL SURVIVAL` in product and
  accessible naming; its loading status no longer introduces a second name.
- Fighter Shop, Upgrade, Missions, and Account remain visually locked but are
  now `aria-disabled` interactive routes. One delegated App listener shows a
  single `COMING SOON` status toast (`SẮP RA MẮT` in Vietnamese); no locked
  surface can launch.

## Release and verification

- Revision advanced to `20261018-content-cp6-r17`; cutover rebuilt 71 files,
  owner fonts were restored, and the 66-runtime lock was regenerated.
- Generated shell counts: `<span>Dictionary</span>` 0, `<span>Archive</span>` 1,
  `data-locked-route` 4, r16 URLs 0.
- Static gates passed: runtime revision r17/66; cutover check 71;
  localization (373 phrases), Gold revision integrity (18), battle-HUD
  adaptation (57), fighter-pick adaptation (15), pick presentation (15),
  battle-HUD live truth (20), Field Archive C04 profiles, Arsenal product
  graph, and Quest Director Q1 (18).
- `testSkillHudTruthBrowser.mjs`: PASS 13/13.
- Live r17 probe: resources carried r17; dock labels/attributes and EN/VI
  toast matched; Quest showed `ENCOUNTERS / REPLAY`; Archive MAGNET, FROST,
  BOXE, and weapon pages showed trimmed labels, curated specs, and the tier
  legend with no old raw metric labels; Pick showed `✦ SKINS ↗`.
- The probe's passive-portrait click helper had an interpolation bug, so
  passive DOM switching was not claimed from that run. The same
  `skillRecords` function used by the UI was printed for all 42 skills and
  reviewed directly; A1 DOM rendering proved the shared spec path live.

## Evidence

- `cp6d-home-locked-toast.png`
- `cp6d-quest-encounters.png`
- `cp6d-archive-magnet.png`
- `cp6d-archive-boxe.png`
- `cp6d-archive-weapon.png`
- `cp6d-pick-skins-entry.png`

CP6 is complete after this checkpoint. R91 owner approval, Story lock for
Public Playtest #1, Result packaging, and later roadmap work remain separate
owner decisions/workstreams.
