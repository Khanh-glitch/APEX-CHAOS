# R91 — Hosted production acceptance (real HUD in Gold Shell)

Date: 2026-10-17 · Branch: `arena/7db52093-apex-chaos` · Revision after this round: `20261017-shuri-rework-r7`
Method: the REAL app (Vite dev) driven through the Gold Shell UI into live battles
(`#apex-boot-start → #freeBattle → mode card → roster → #lockIn`), hero picks verified
against the pick identity zones. Per context: measure+screenshot raw, grant the longest
weapon names via `APEX_ARSENAL.weaponApi.equip` (PANCOR JACKHAMMER 17ch / MOSSBERG 500)
and measure immediately, press skills via `APEX_GOLD.pressSkill` and capture cast states.
Driver preserved as `hosted-suite.mjs`; raw measurements in `suite-results.json`;
24 screenshots `<context>-<raw|weapons|cast|cooldown>.png`. Engine test seams were NOT
used (they bypass the Gold Shell HUD mount).

## Contexts and overflow verdict (production, all phases)

| Context | Viewport | Mode/Lang | Overflow rows |
|---|---|---|---|
| desk1366-bot-en | 1366×768 | BOT 1P EN (MAGNET vs CRYSTALA) | **0** |
| desk1366-bot-vi | 1366×768 | BOT 1P VI (MIRROR vs MAGNET) | **0** |
| land932-bot-en | 932×430 | BOT 1P EN | 1 — CPU weapon strip only (excluded class) |
| port390-bot-en | 390×844 | BOT 1P EN | 1 — CPU mini skill readout only (excluded class) |
| port390-bot-vi | 390×844 | BOT 1P VI | 1 — CPU mini skill readout only (excluded class) |
| port430-local-en | 430×932 | Local 2P EN (MAGNET vs MAGNET) | **0** |

Excluded class = the donor's deliberate CPU tertiary readouts in 1P (56–64px status
columns @9.5–12px): port390 CPU `sk-name-1` "CONTEXT CONSTRUCT" +27px (VI "KIẾN TẠO
THÍCH ỨNG" +25px), land932 CPU `wp-name` "MOSSBERG 500" +27px. R91 never touched these.
Production corrected two standalone artifacts: the VI 28ch hero tag fits at desk
(ApexVietCondensed), and CPU "CRYSTALA" fits the port390 strip. D2 production-closed:
port390 BOT P2 `.wp-name` computes cw=0 (text set, not rendered — the `.wp-txt`
display:none law). Weapon-block internal overflow ≤4px everywhere (tolerance 8).

## Gate ordering fix (owner-ordered) — and the defect it caught

`tools/testBattleHudLabelFitBrowser.mjs` previously measured `.weapon` block overflow
only AFTER the name had been replaced by the 12ch string. It now also measures the
block while the 17ch name is displayed (`wp-block-17`), with offender diagnostics.
The fixed gate immediately failed: `desk-1366-1p P1 wp-block-17 tileOv=19`.

Root cause (proven, in R91 itself): the R91 `.wp-name` wrap rule lacked the
`:not([data-layout="desk"])` exclusion that the `.sk-name` rule carries — contradicting
R91's own documented law ("desk: no wrap, it clips the fixed-height desk tile").
At desk-1366 standalone, "PANCOR JACKHAMMER" (175px box) wrapped to 2 lines
(name height 18→36px), pushing ammo/mag-bar 19px past the 83px weapon block.
In hosted production it happened to sit exactly on the one-line boundary (175/175)
— a boundary-fragile state that could wrap on another machine. The pure glyph run
at donor law (16px/.08em) is ~203px: the original Gold desk law ellided this name.

Fix (restores R91's intended design, donor untouched): desk excluded from the
`.wp-name` wrap rule + a desk micro-step mirroring the desk `.sk-name` law:
`font-size:clamp(13px,1.85cqh,14.5px); letter-spacing:.02em`. Measured after:
desk-1366 glyph run 165px in the 175px box (10px margin), one line, block overflow 0;
hosted production f=14.208px, blkOv=2. Gate: **154/154 PASS** (max tileOv 5).
Revision bumped r6→r7 (66 runtimes relocked); battery: cutover --check OK,
adaptation 57, LiveTruth 20, embedded parity, Quest B3 13, revision-integrity 18,
runtime-revision PASS r7, hero-rework smoke 18/18.

## Visual parity read (beyond overflow)

- Typography hierarchy intact everywhere: hero name > skill name > desc > micro-labels.
  Desk worst cases sit at 13.056px (skills) / 14.208px (weapon) inside full-size tiles
  with real skill art — no cramped feel, no elision.
- Portrait Local 2P: two-line skill/weapon names sit naturally in the tall admission
  tiles (art above, name below); P2 deck rotated 180° face-to-face as designed.
- VI (ApexVietCondensed): "KHO VŨ KHÍ PHẢN CHIẾU", tags, "SẴN SÀNG", "TAY KHÔNG",
  "HỒI CHIÊU 15,0s" all clean; diacritics crisp, hierarchy preserved.
- Weapon card: desk one-liners strong; portrait "PANCOR / JACKHAMMER" two-line wrap
  reads as designed with clear ammo numerals.

## Observation for owner judgment (NOT an R91 defect, no change made)

Cast choreography was sampled on MAGNET/CRYSTALA/ROBOT: tile shows
`PRESS-CAST → ACTIVE Xs countdown → READY`. A long numeric cooldown countdown never
renders on the tile in this build: after the active window the tile returns to READY
with a full meter while the internal cooldown is still running (verified against the
rework authority: after casting ROBOT A2, `cooldownLeft('A2')=6.25s` and
`skillHud()` reports "K · ROBOT.a2 6.3s" while the Gold tile displays READY;
recasts inside the nominal CD are rejected). This predates R91 (R91 changes only
label typography) and may be deliberate Gold choreography; representative "cooldown
running" frames in this pack are therefore the PRESS-CAST / ACTIVE-countdown states.
Flagged only — any change would be a separate owner decision.

## Status

R91 (+ this defect fix) checkpointed on the session branch only. No merge, no deploy.
Awaiting owner Gold visual-parity approval. Reverting the R91 commits restores r5
exactly; the owner Gold donor remains untouched (adapter-only changes).
