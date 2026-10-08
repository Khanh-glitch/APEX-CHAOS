# APEX CHAOS Quest 01 — Q3v scoped viewport and readability audit

Date: 2026-10-09. Starting tested SHA: `c7e272cdaefb6339c6033480c72e083a9fc1cf49`.
Branch: `quest/q3v-scope-safe-readability-from-q3u`.
Status: **AUDIT STAGE, NOT OWNER VISUAL APPROVED**.

## Owner instructions
- The previous Q3u 1024×768 tablet screenshot is **visually broken/unattractive despite green CI**. This is a confirmed owner observation; do not mark tablet layout visually approved.
- Another branch is actively redesigning cross-device responsive layout. **No global re-layout here**: do not change Gold grid, arena, side geometry, breakpoints, profile, Home, Pick or standalone mobile system.
- Quest changes, if justified by evidence, are limited to independent HP display, names/faction labels and readability. Preserve one Gold two-rail envelope, no invented character skills/equipment.
- Never import moving R59 responsive changes without separate audit. No Cloudflare deployment or merge.

## What Q3v adds to acceptance
The existing Q3u small-device checks establish only bounding-box intersection and rail horizontal containment. Q3v adds full x/y canvas and rail containment, separate rendered HP-current/HP-max text fit and timer-overlap checks, and visible/uncropped faction-name checks. Each viewport writes a structured JSON alongside its actual screenshot; phone 320×568, 360×560 and landscape tablet 1024×768 are tested inside mounted 3v4 Gold. No CSS change is necessary to expose a previously missed failure.

## Important coverage limit
A geometry PASS remains **technical only**. K title truncation, panel emptiness, typography hierarchy, V12 spring quality and sprite clipping at physical arena boundary require additional independent QA and owner screenshot inspection. Record a FAIL rather than weakening a nontrivial gate just to obtain green CI. The original Q3u run 37814576057 and documentation remain immutable.

## Next
1. Run the new isolated Q3v CI. Inspect JSON/log failures, not merely the status flag.
2. Fix only proven Quest-owned rail/name defects without modifying Gold overall layout. Maintain standalone/embedded Gold HUD source equality if altered.
3. Keep U-01 sprite edge visuals, U-04 RIVET placeholder, U-05 FX overlap, U-06 weapon-angle review, U-07 real wave scripting open until truly proven.

## Q3v.1 actual CI and owner-gated result (2026-10-09)
- Green run: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37817024121 at `3aa94dca9a91c98989b34597b8bf89a49333a682`. Existing Arsenal/Q1/Q2/Chrome regressions and new 3-view geometry checks PASS.
- **DO NOT PROMOTE TABLET TO VISUAL PASS.** Owner specifically observed the Q3u tablet image as broken and extremely unattractive, and no new layout correction was shipped. Geometry passing again is a measurement limitation, not a disagreement with owner observation.
- Real Chrome 1024×768 tablet: canvas left/right `216..852` (636px); Gold side left `8..208` (200px), right `860..1016` (156px). Two side regions are **44px asymmetric** and the arena is not centered in viewport. This is a measured composition issue, not proven root cause of all visual concerns.
- Tablet Gold HP rail endpoints `8..534` and `534..1016`; hp digits are in view; current values 3000/3000 and 1140/1140. This proves text containment only.
- Real Chrome 320×568: arena 252px square; both rails and digits contained. Real Chrome 360×560: arena 244px square; both rails and digits contained.
- All new Q3v geometry checks PASS despite tablet owner VISUAL FAIL. More numerical gates alone will not establish beautiful panel composition. **Keep cross-device layout remedy on the separate responsive branch.** Hereafter Quest branch may address only labels/HP identity and maintain truthful sparse enemy-side display, without overwriting that branch's layout choices.
- Existing audit still does not sample collision-radius-versus-V12-sprite edge excursions or long-run FX readability under real waves. Those remain OPEN.
- No R59 merge, no Cloudflare production deploy, no owner visual sign-off. The next appropriate owner touchpoint is a screenshot/feel acceptance after the separate layout branch stabilizes and Quest-only labeling is reviewed.
