# CP6c — Meta-language sweep (r16)

Owner scope: CP6 `full`; this checkpoint removes development/pipeline language
from player-facing copy without changing Gold composition, HUD structure, or
gameplay behavior. R91 and the owner Gold library were not edited.

## Player-facing changes

- Quest hub diagnostic entries keep their existing IDs, callbacks, and
  localhost/test-only visibility, but no longer expose checkpoint codes:
  - `FIRST WAKE · TRIAL`
  - `REFLEX · COMBAT TRIAL`
  - `REFLEX · STORY TRIAL`
- Story caption `FRONTLINE HANDOFF` became `FRONTLINE TAKEOVER`, matching the
  existing Vietnamese sense of taking control of the front line.
- Archive readouts now say `LV1 · ROLE PROFILE`, `ARSENAL RECORD · <tier>`,
  and simply `TACTICAL AFFINITY`. The lower notes became
  `APPEARANCE ONLY — NO COMBAT EFFECT` and `EQUIP APPLIES INSTANTLY`.
- The two Gold skin details are now object flavor instead of production
  provenance:
  - “The laughing warhead keeps its full face in frame, trailing thick
    theatrical smoke.”
  - “Forest-jade mechanical layers over a spring-driven NEWBOT frame.”
- Legacy Arsenal result/lab navigation says `HOME`, unavailable fighters say
  `LOCKED`, and back controls are labelled “Back to Home”. Product-graph
  details were also made player-safe if a future surface renders them.
- Gold Pick now uses `BATTLE READY`; locked roster tooltips say `LOCKED`.

## Implementation shape

- Normal runtime and React copy was changed at its existing source authority.
- Gold shell text was changed only through the cutover generator:
  `SHL-S60` replaces the donor's initial banner, downstream generated seams
  and the R50K adapter emit `BATTLE READY`, and both roster-builder outputs
  emit the short locked tooltip. Donor files and donor-matching find patterns
  were not rewritten.
- Vietnamese catalog keys were renamed with their English sources, obsolete
  `EXTENSION POINT` entries were removed, and translations were added for the
  new Archive and skin copy. The localization gate now reports 364 curated
  phrases.
- Revision advanced to `20261018-content-cp6-r16`; cutover rebuilt 71 files,
  owner fonts were restored after generation, and the 66-runtime lock was
  regenerated.

## Verification

- Generated shell counts: `BATTLE HANDOFF READY` 0, `BATTLE READY` 3,
  `LOCKED — EXTENSION POINT` 0, r15 URLs 0.
- Static gates passed: runtime revision r16/66; cutover check 71;
  localization (364 phrases), Gold revision integrity (18), battle-HUD
  adaptation (57), fighter-pick adaptation (15), pick presentation (15),
  battle-HUD live truth (20), Field Archive C04 profiles, Arsenal product
  graph, and Quest Director Q1 (18).
- `testSkillHudTruthBrowser.mjs`: PASS 13/13.
- Live r16 probe: loaded resources carried r16; Quest labels and Vietnamese
  translations matched the three trial entries; Pick showed `BATTLE READY`
  and all six locked titles as `LOCKED`, localized to `SẴN SÀNG VÀO TRẬN`
  and `CHƯA MỞ` in Vietnamese.
- Archive fighter and weapon screenshots visually confirm the four header /
  footer replacements. A malformed regex in the probe's auxiliary Archive
  DOM reader is recorded here rather than hidden; the screenshots and source
  gates are the evidence for those labels.

## Evidence

- `cp6c-quest-hub.png`
- `cp6c-archive-magnet.png`
- `cp6c-archive-weapon.png`
- `cp6c-pick.png`

Next: CP6d curates Archive metrics, reduces remaining density, unifies
feature labels, adds the T1–T6 legend, and gives locked routes feedback.
