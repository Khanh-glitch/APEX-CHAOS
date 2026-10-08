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
