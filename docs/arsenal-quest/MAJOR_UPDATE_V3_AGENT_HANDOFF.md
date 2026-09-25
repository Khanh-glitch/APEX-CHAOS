# APEX CHAOS — ARSENAL V3 AGENT HANDOFF

**Date:** 2026-09-25
**Repository:** `Khanh-glitch/APEX-CHAOS`
**Authorized implementation branch:** `arena/01a0cf5e-apex-chaos`
**Protected accepted runtime baseline:** `75c8879d83f03a33854b34b4d55e775d8027cce9`

This handoff serializes the implementation order for the V3 major update.

## AUTHORITIES TO READ IN FULL

1. `docs/arsenal-quest/MAJOR_UPDATE_V3_COMBAT_VISUAL_AUTHORITY.md`
2. `docs/arsenal-quest/ARSENAL_V3_META_UI_UX_RUNBOOK.md`
3. `docs/arsenal-quest/BRANCH_PRUNE_SAFETY_RUNBOOK.md`
4. `docs/arsenal-quest/FULL_FEEL_AND_SMOOTHNESS_IMPLEMENT.md`
5. `docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md`

Also inspect current runtime rather than assuming older handoffs are still exact.

A stale local file named:
`docs/arsenal-quest/MAJOR_UPDATE_V3_GAMEPLAY_VISUAL_AUTHORITY.md`
has been intentionally retired. After fetch/prune it must NOT be used as authority.

---

# EXECUTION ORDER

## CHECKPOINT 0 — V3 REPO HYGIENE COMPLETE

Fetch/prune first.

Verify:
- `main` contains accepted baseline `75c8879d...` or descendant;
- Arena contains same accepted baseline plus V3 authority docs;
- `playtest/arsenal` remains preserved;
- `prototype/aftermath-32` remains preserved.

Following `BRANCH_PRUNE_SAFETY_RUNBOOK.md`, delete only the explicitly approved redundant remote branches.

If any candidate moved/gained new unique commits, do not delete it blindly; report it and continue with implementation.

Branch deletion is Git maintenance, not a source-code commit.

## CHECKPOINT 1 — FRESH BASELINE

Before source edits:
- run complete headless suite;
- run production/Vite build;
- run complete browser suite;
- capture current normal-scale browser screenshots of:
  - existing splatter;
  - existing damage popup;
  - representative gun scale extremes;
  - CARD/MATH/MATH_V2 in Arsenal;
  - current Arsenal pick/HUD.

The authority commits use `[skip ci]`.
Do not cite old CI as fresh baseline proof.

## CHECKPOINT 2 — V3 COMBAT CORE COMPLETE

Implement only:
- 1000 HP;
- Arsenal equipment x7 damage;
- x7 heal amounts + 800 threshold;
- firearm crit system;
- V3 4.5s cadence / cap 5;
- firearm-specific emergency supply predicate.

Add deterministic anti-false-positive gates.

Run full headless + build + browser.

Do not proceed until this checkpoint is green.

## CHECKPOINT 3 — V3 VISUAL PARITY COMPLETE

Implement:
- crisp three-color damage/heal/crit number system;
- non-linear size-band caches;
- crit icon/punch;
- manga blood splatter;
- normalized firearm display scale + anchor continuity;
- native fighter visual parity / remove blanket canvas-text mute safely.

Browser evidence is mandatory.

Required focused evidence:
- normal red damage;
- orange crit + mark;
- green heal;
- manga splatter for multiple weapon families;
- small/large firearm scale comparison;
- CARD;
- MATH;
- MATH_V2;
- SNIPER/HUNTER;
- Newbie.

Run full suites again.

## CHECKPOINT 4 — V3 META UI COMPLETE

Implement `ARSENAL_V3_META_UI_UX_RUNBOOK.md`.

Do not invent a new visual system.
Reuse committed pick/UI assets and layout grammar.

Implement:
- Arsenal Hub;
- versioned Arsenal meta save;
- AC economy;
- Shop;
- no-duplicate Lucky Draw;
- owned-roster gating;
- Newbie defaults;
- Quest fixed opponent pick state;
- final battle HUD;
- reward/result UI.

No external asset sourcing is required unless a specific missing-functional-asset blocker is proven.

Capture all required normal-scale UI screenshots.

Run full suites again.

## CHECKPOINT 5 — V3 SMOOTHNESS + EVIDENCE COMPLETE

Profile the FULL V3 workload after features/UI are present.

Use existing real-rAF telemetry.

Do not improve performance by reducing:
- particle count;
- blood density;
- popup readability;
- VFX lifetime;
- DPR;
- audio quality;
- accepted effects.

Fix measurable hot-path regressions.

If frame cost is healthy but motion still visibly steps, use the previously authorized Arsenal-only visual smoothing/interpolation path only when evidence supports it.

Simulation/collision must remain authoritative.

Run:
- complete headless;
- Vite production build;
- complete real-browser suite;
- real-rAF report;
- visual regression evidence.

Create a final evidence refresh commit separate from implementation where practical.

---

# SOURCE / ASSET FACTS ALREADY AUDITED

- Existing `pick_ui_final` asset system is sufficient for V3 Hub/Shop/Draw/Pick/HUD art language.
- No external art download is currently required.
- Existing `speckBlood.webp` is available as one manga-splatter ingredient.
- Existing `damage1.png` remains canonical number glyph source.
- Current gun renderer directly consumes raw generated world dimensions, causing excessive scale variance.
- Current Arsenal `baseDraw()` text mute is the root cause of several missing native fighter visuals.
- Current Arsenal pick records intentionally emit blank art fields for shells and need a real fallback integration.
- Current accepted offensive cadence/cap are 3.0s / 8; V3 authority supersedes them to 4.5s / 5.
- Current accepted main runtime was safely fast-forwarded before branch cleanup planning.

---

# NON-REGRESSION

Do not:
- modify `main`;
- move `playtest/arsenal`;
- delete `prototype/aftermath-32`;
- rebuild weapon audio;
- replace accepted Chamber floor;
- alter rarity probabilities unless required by explicit V3 authority;
- introduce new native-fighter damage scaling;
- restore legacy FloatingText;
- invent untruthful HUD ammo;
- add premium currencies/daily/pity/duplicate-shard systems;
- source new external assets merely for decoration.

---

# FINAL REPORT REQUIRED

Return:
- fetched starting SHA;
- repo hygiene result + remaining remote branches;
- baseline headless/browser/build;
- V3 COMBAT CORE SHA;
- V3 VISUAL PARITY SHA;
- V3 META UI SHA;
- V3 SMOOTHNESS SHA;
- evidence SHA;
- final CI run/status;
- final headless/browser counts;
- Vite status;
- exact combat scaling proof;
- exact crit config + deterministic proof;
- spawn predicate/cap/cadence proof;
- manga splatter browser evidence;
- damage-number pixel/readability proof;
- weapon scale/anchor proof;
- fighter visual parity proof;
- Hub/Shop/Draw/Pick/HUD evidence;
- meta economy persistence proof;
- real-rAF before/after/full-workload report;
- genuine remaining blockers only.

Do not promote playtest.
Do not touch main.
