# CP5 (r13) — Tieutiet visual trio (2026-10-18)

Revision `20261017-shuri-rework-r13` (lock 66). All three items are paint-only
micro-fixes inside existing authorities — no Gold RECREATE, no layout
geometry changes, no gameplay. Shell changes ride the cutover patch system
(`SHL-S58`, `SHL-S59` in `tools/buildGoldCutover.mjs`); the floor change
rides the Chamber palette painter's cached surface.

## 1. Portrait Home hero grounding (SHL-S58)
- Measured before (390×844): `.heroWrap` top-anchored at `top:6.5vh`
  (y=55..498) — feet dangle mid-smoke; desktop instead bottom-anchors and
  crops, which reads as planted.
- Change (inside the donor's own portrait block, Home only):
  hero lowered 2.5vh (`top:9vh`, `#stage:not(.screen-*)` scoped) + a soft
  radial contact shadow (`.heroWrap::after`, blurred ellipse under the
  feet, `pointer-events:none`, behind the hero layers).
- After: y=76..519 (+21px exactly), shadow present; CTA/title clearances
  kept (feet 519 < actions ~545). Mode/pick anchors untouched.
  Shots: `A1-home-portrait-before.png`, `A2-home-portrait-after.png`.

## 2. Battle-wait VS focal (SHL-S59)
- Measured the real entry: lock → clamp (~0.7s) → **seam hold ~2.4s while
  the HUD preloads** → open → handoff. The seam hold is the wait screen.
  Frozen-state inspection showed its centre chip (250px, 8–12px microcopy)
  both lacked a focal **and occluded the middle of both fighter names**
  (plates hug the centre; chip covered the inner ~74px of each name).
- Change (CSS-only on the existing chip): a `VS` glyph in the pick
  screen's own versus language (`.versusGlyph` face/italic/glow) as the
  chip's `::before`, and the chip hung **below the name axis**
  (`top:calc(50% + 104px)` in the vertical variant; the horizontal
  Local-2P variant never overlapped, so it keeps donor centre).
- Measured after: chip↔name intersection **0px² in both variants**; names
  fully readable for the whole hold; seam glow threads into the chip.
  Shots: `B1-seam-before.png` (pre-CP5 hold), `B2-seam-after.png`.

## 3. Arena floor grain (Chamber painter)
- The cached chamber surface already had gradient + grid; the flat read
  came from zero surface grain between grid lines. Added whisper-light
  seeded speckle (LCG seeded by palette id + size) baked into the cached
  surface with the palette's own inner/outer hues at 5–11% alpha, r≤2.3px,
  inside the walls — grid geometry, palettes and readability math
  untouched; zero per-frame cost (surface still builds exactly once per
  (size,palette) key — verified via runtime stats).
- Measured: 179 speckle edges in one 90×90 floor cell (flat gradient
  yields ~0); mean adjacent-step luminance 0.69 across sampled cells —
  present but appropriately faint.
  Shots: `C-floor-zoom.png` (3× crop), `D-arena.png`.

## Spawn pentagon shells — judged in motion, no change
Frames at 00:01–00:03 across several entries show both fighters clean
(the dashed element near spawns is the transient weapon-drop/spawn
marker, gone ~1s; both fighters spawn unarmed — proven CP1). No proven
defect, no change.

## Gates
- buildGoldCutover --check: OK (71 files)
- Pick adaptation 15, Core-six 106, Band law 79, HUD adaptation 57,
  Revision integrity 18, BattleHudLiveTruth 20: PASS
- Runtime revision: PASS r13/66
- Skill HUD truth browser: PASS 13/13
- Chamber: `testChamberPaletteGates` needs `@sparticuz/chromium`
  (not a declared dependency; unavailable in this sandbox). Equivalent
  contract probe run against the live runtime instead: 7 palettes,
  `surface()` cache builds exactly once per key (second call no rebuild,
  same canvas), grain present on the cached surface, resource URLs carry
  `v=…r13`. The change is confined to `paint()`; actor-render wrappers
  untouched.
- Fighter Select pager: 27/29 — the two B items (Local P2 SHURI pick +
  LOCK×2) are the known pre-commit lock-tap race. Proven NOT a CP5
  regression by `git stash` A/B: identical 27/29 on pre-CP5 r12 code.
  The gate passed 29/29 at CP3 and the hardened skill-truth gate
  (lockUntil presses, CP1) passes the same product flow today.
  Recommend a future tooling pass giving the pager gate the same
  `lockUntil` discipline; not done inside CP5 scope.
