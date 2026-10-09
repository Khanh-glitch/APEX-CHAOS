# R90 — Independent Gold HUD debt and safe-merge boundary

Date: 2026-10-09. The Quest 01 branch is ACTIVE and is not a merge input for this work. R89 remains frozen at `60fec477997d913e04cd3f3a1441b90465aacf62`. This is a test/evidence-only branch: **no Gold donor, generated HUD, gameplay, quest, layout, or production files are changed**.

## Findings verified from unmodified acceptance gate at R89
- **R52 Pick band gate — static test stale vs accepted R81:** R52 remains the last authority for the LOCK-safe `bottom` and `height` (three authored Gold bands). The gate incorrectly banned R81's later `#stage.screen-fighter .selectionDeckV6{top:70.8vh!important}`, which is scoped to `@media (orientation:portrait) and (max-width:420px) and (max-height:650px)`, and touches the TOP edge only. The old assertion was therefore a false positive. The re-based test checks all emitted R52 bottom/height declarations and verifies exactly one R81 top-only exception, rejecting all other late rules. Browser verification requires real Fighter Pick deck to sit ABOVE the LOCK in 360×560 and 550×857, as well as all existing R77/R81 tests. **Do not call this fixed until new Chromium CI passes.**
- **Battle HUD R65 — missing visual-state authority:** The original test requires an artwork-level ACTIVE/CD treatment and hero-specific motif. Current shipped HUD has some skill state filters and `apex-hero-motif`, but the expected integrated R65 art treatment is not present. This is an unresolved presentation decision, not safe to fix by adding a comment/marker.
- **Battle HUD R63 — missing iPad solo skill-state authority:** Runtime computes `cast/active/ready/cd`, but the specific R63 portrait iPad visibility rules are not present. Do not alter tablet BOT composition because the owner previously rejected tablet visual appearance.
- **Battle HUD R62 — tablet BOT dock:** The test expects an `id/id/id` + `s1 wp s2` bottom skill/weapon dock, which does not exist in current production HUD. The product may be playable but that does not prove the requested visual arrangement. It must be resolved against the owner Gold references before any geometry change.
- **Quest 01 boundary:** Quest Q3v explicitly said 1024×768 tablet looked broken/ugly despite prior geometric CI PASS; that complaint is not canceled by R89 scaling. Another branch owns Quest HP/name/faction presentation. NEVER edit `public/gold/shell.html`, `public/gold/battle-hud.html` or Quest actor systems here. R89/Quest merge rehearsal already found a Shell Base64 payload conflict requiring a verified generated-source merge.

## Acceptance matrix
| Law | Current status | Independent next verification |
|---|---|---|
| R52 lock bottom/height + R81 top-only | *re-attributed; browser proof required* | Exact static lock law + 360×560 and 550×857 LOCK/deck rendered-gap test |
| R65 ACTIVE/CD art effect | **OPEN** | Real artwork state screenshots, source-owned adapter after owner-directed visual choice |
| R63 tablet BOT state readability | **OPEN** | Tablet portrait BOT state sequence with authored Gold design reference |
| R62 tablet BOT dock | **OPEN** | Owner-approved layout direction, no parallel layout redesign |
| Quest Q4E merge | **DEFERRED** | Freeze Quest HEAD, three-way merge, regenerate embedded HUD from canonical adapter |

## Change/rollback constraints
- This branch changes test infrastructure ONLY. R89 original Gold source and original Battle HUD gate are unchanged.
- The R90 inventory script *runs the original HUD gate* and reports its three known failures clearly. If a new failure appears, the inventory CI fails. Inventory SUCCESS is NOT product acceptance.
- Do not clear owner acceptance by deleting failing assertions, inserting expected text into output, or loosening geometric criteria. Keep accurate red status when real visual authority is missing.
- The known R89 global acceptance 2/49 failures are unrelated to any new Quest changes; the Frost F05.8 occasionally fails separately and needs isolated confirmation if recurring. 
