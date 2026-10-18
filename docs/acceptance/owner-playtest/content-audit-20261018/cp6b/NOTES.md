# CP6b — Canonical skill names (r15)

Owner scope: CP6 `full`; this checkpoint implements report §3 plus the hero
# display-name completion needed to keep one canonical naming source.

## Canonical names

- Registry is now the authored source for all 42 skill `displayName` values.
- Core-six canonical changes:
  - HUNTER passive: `Predator's Law`
  - CRYSTALA passive/A1: `Refraction`, `Hexa Construct`
  - MAGNET passive: `Magnetic Acceleration`
  - FROST passive: `Frozen Bullet` (kept after verifying the proc mechanic)
  - MIRROR A2: `Atomic Exchange`
- Eighteen locked-hero skills received authored names, removing bare or
  developer-shaped derivations such as `BREATH`, `HUNT`, `ARSENAL`, `LOOP`,
  `NEST`, and the `DAMAGE *` family from player-facing copy.
- Registry hero display names now resolve `ROBOT -> NEWBOT`,
  `BLACK_HOLE -> BLACK HOLE`, and `MATH_V2 -> MATH V2`; production IDs are
  unchanged.

## Implementation shape

- `heroRegistry.js`: 36 missing skill extras were added through the existing
  `skill(..., extra)` contract. Core-six skills also received short canonical
  `archiveProfile.description` copy; BOXE/SHURI kept their existing registry
  descriptions.
- `goldProductBridge.js`: `GOLD_SKILL_COPY` is the complete uppercase Pick/HUD
  projection for all eight playable heroes, including passives. HUD name
  resolution now falls back to registry `displayName` before mechanic-derived
  text.
- `FieldArchiveC03.jsx`: legacy HERO_META names/descriptions were aligned to
  the canonical registry copy; the MAGNET intro lost the eligibility jargon.
- `localeCatalog.js`: added Vietnamese pairs for the renamed skills, locked
  skill names, six Archive intros, and eighteen core-six skill descriptions.
- Tests were updated to protect the new canonical strings rather than the
  retired names. The HUD label-fit fixture now uses the real long A2 label
  `MECHANICAL GENESIS`.
- Revision advanced to `20261018-content-cp6-r15`; cutover rebuilt 71 files,
  owner fonts restored after generation, and the 66-runtime lock regenerated.

## Mechanic-truth decisions

- FROST passive rolls freeze on eligible projectile hits (8% total Lv1 proc,
  0.9s freeze), so `Frozen Bullet` is the accurate name and the stale
  timer-refresh description was replaced.
- HUNTER WEAK profile is 1.0s with 1.25 incoming and 0.75 outgoing damage;
  the canonical description states those player-visible effects directly.

## Verification

- Runtime APIs returned canonical names for all eight playable heroes and
  representative locked heroes.
- Live Pick chips verified for HUNTER, CRYSTALA, MAGNET, FROST, and MIRROR.
- Live MIRROR battle HUD showed `MIRROR ARSENAL` and `ATOMIC EXCHANGE` with
  no `.sk-name` overflow.
- Live Archive INFO showed MAGNET `Magnetic Attraction` with the new short
  description. BOXE confirmed that its registry description already renders;
  its length is a density issue reserved for CP6d, correcting the audit's
  broader "missing text" wording for skills.
- Static gates passed: runtime revision r15/66; cutover check 71;
  localization (357 phrases), Gold revision integrity (18), battle-HUD
  adaptation (57), fighter-pick adaptation (15), pick presentation (15),
  battle-HUD live truth (20), Field Archive C04 profiles, and product graph.
- `testSkillHudTruthBrowser.mjs`: PASS 13/13.

## Evidence

- `cp6b-pick-mirror.png`
- `cp6b-hud-mirror.png`
- `cp6b-archive-magnet.png`
- `cp6b-archive-boxe.png`

Next: CP6c removes player-visible meta/dev copy; CP6d handles Archive
density, curated metrics, feature-label consistency, tier legend, and locked
dock feedback.
