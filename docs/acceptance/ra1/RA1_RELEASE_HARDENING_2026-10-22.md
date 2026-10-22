# RA-1 — Release Hardening Report (2026-10-22)

**Scope:** RA-1 only (release hardening / player-visible defect closure). No RA-2..RA-4.
**Baseline:** `7ecc7f65fc5c0822fd5b257e27e58e9894f15f22` (verified HEAD before work).
**Branch:** `arena/d7ff52e8-apex-chaos` → PR #101 (Draft, unmerged).
**Status:** implementation + self-QA complete. **NOT owner-accepted. Not merged, not deployed, not published.**

All evidence referenced here is committed under `docs/acceptance/ra1/` so the owner can open it
directly in the repo; the machine-readable matrices are the JSON files in the same folder.

---

## 1. Verdict (scoped to RA-1)

**CONDITIONAL — READY FOR OWNER ACCEPTANCE REVIEW.**

Every P1 defect that reproduced was fixed at its source authority and re-verified in a real
browser. Two items stay open by design and need the owner, not engineering:

1. **Match-duration law (RA-1.D).** The product Arsenal match ends on KO only; no time limit
   exists. Measured, documented, recommended — **not changed**, because that is a gameplay rule.
2. **Physical-device proof.** All evidence is Chromium (headless, touch emulation). iOS Safari,
   Samsung Internet and low-end Android hardware remain **UNVERIFIED**.

---

## 2. Defect register

| ID | Severity | Where | Reproduced | Root cause | Fix | Evidence | Status |
|---|---|---|---|---|---|---|---|
| HUD-1 | P1 | Battle HUD, compact portrait BOT, 320–430 px | Yes — live match, not fixture | `#p2Rail .vr-name` duplicated the opponent name inside the narrow HP rail; at 390×844 its box (x 291.9→339.6) overlapped `.vr-hp` (x 236→303.8) by **11.95 × 11 px**, painting the trailing `ER` of HUNTER onto the HP numerals | Rail copy suppressed only in `[port][compact][1p]`; the identity card keeps the name | `assets/hud-p2-identity-after-390x844.png` | **FIXED** |
| HUD-2 | P1 | Same band, ≤340 px | Yes — 320×568 screenshot shows the P2 portrait painting over the name (`…NTER`) | The mirrored identity row cannot hold a 34 px portrait + the full name beside the retained skill summary (`id-txt` was 29 px wide inside a 70 px card; the portrait sat at x 280→314 covering the text’s 234→273 box) | Portrait removed **only** at `max-width:340px` in that band (redundant with the live fighter and the P2 badge); Quest untouched | `assets/hud-p2-identity-before-320x568-crop.png`, `assets/hud-p2-identity-after-320x568.png` | **FIXED** |
| TUT-1 | P1 | First-play coach, skill lessons | Yes — hybrid context (page reports `(pointer: coarse)` false while the player touches) | Copy was chosen once at mount from `(pointer: coarse)`; a phone with a paired mouse / fine primary pointer taught “Press J” | Copy follows the **last real input modality** (`pointerdown` type) plus a live media-query listener. Both input contracts stay accepted; no gameplay change | `assets/tutorial-hybrid-lesson-390x844-vie.png` (after), gate scenario B | **FIXED** |
| RES-1 | P1 | Match Result, **nested itch hosting only** | Yes — locally served `/html/apex/` package | `heroPortraitSource()` / weapon art accepted art only when it started with an exact `/assets/`; the portable pack rewrites first-party literals to `../assets/…`, so SHURI/BOXE (dictionary art, not gold-ui) fell back to a fabricated `gold-ui/.../pick_selected_large.webp` → **404 + placeholder portrait** | `appAssetPath()` accepts `/`, `./`, `../` and bare spellings, still rejecting traversal, protocols and non-images | Before: 404 `…/shuri/pick_selected_large.webp` + `Ảnh nhân vật · placeholder`; after: `standing.webp` 1122 px decoded, weapon art decoded, 0 first-party 404 | **FIXED** |
| SEL-1 | P2 | Fighter Select pager | Yes — pager settled 4 px off the snap target | Page starts measured from the scrollport edge instead of the CSS snapport (`scroll-padding-left`) | Controller and helper use the computed inset (fixed before RA-1, re-verified here) | `testFighterSelectPagerBrowser` 29/29 | **FIXED** |
| SEL-2 | — | Fighter Select, all 14 entries | — | — | — | `testRa1FighterArtCoverageBrowser` 135/135 | **NOT REPRODUCED** (art and picking are intact at 320/390/844/1440) |
| DUR-1 | P1 investigation | BOT match length | Partly | KO-only termination, no cap, clock counts up | Report + recommendation only (below) | `bot-duration-9matches.json` | **OPEN — owner decision** |
| MIRROR | — | MIRROR preview | — | Owner rule: no static pose until the opponent is picked | Kept exactly; verified both directions | `assets/fighter-mirror-derived-390x844.png` | **EXPECTED BY DESIGN** |
| LOCKED | — | 6 future fighters | — | Not playable yet | Near-black `LOCKED` state is owner-preserved, not a broken image | `fighter-art-matrix.json` | **EXPECTED BY DESIGN** |

---

## 3. What changed (technical)

1. `tools/goldBattleHudR91labelFit.mjs` — the only HUD authority touched. Adds two scoped rules:
   `[port][compact][1p] #p2Rail .vr-name{display:none}` and, inside `@media(max-width:340px)`,
   `#p2Side .portrait{display:none}`. No frame geometry, colours, arena, skill icons or
   choreography values changed; Local 2P, landscape, tablet, desktop and Quest are untouched.
   `public/gold/battle-hud.html` + `manifest.json` are regenerated by `tools/buildGoldCutover.mjs`.
2. `src/ui/FirstPlayGuide.jsx` — input-appropriate copy (see TUT-1). Presentation only.
3. `public/game/results/matchResultAuthority.js` — `appAssetPath()` (see RES-1).
4. New gates + measurement tool (all listed in `package.json`):
   `testRa1TutorialInputBrowser`, `testRa1ResultArtCoverageBrowser`,
   `testRa1FighterArtCoverageBrowser`, `testRa1CompatibilityBrowser`,
   `testRa1NestedItchHostingBrowser`, `measureRa1BotMatchDuration`.
5. Existing gates extended, never loosened: HUD adaptation (+2 checks for the new scoped rules),
   Result authority (+2 assertions for the portable spelling and for traversal rejection).

---

## 4. Test matrix (exact results at this HEAD)

| Gate | Result |
|---|---|
| `testBattleHudLabelFitBrowser` (13 viewport/mode contexts × EN/VI) | **154 / 154** |
| `testGoldBattleHudAdaptationGate` | **61 checks** |
| `testGoldBattleVisibilityGate` | **27 checks** |
| `testGoldBattleLifecycleGate` | **52 checks** |
| `testFighterSelectPagerBrowser` | **29 / 29** |
| `testGoldPickBandLawGate` | **87 checks** |
| `testGoldFighterPickAdaptationGate` | **16 checks** |
| `testGoldRevisionIntegrityGate` | **18 checks** |
| `testResultGoldAuthority` | PASS (47 titles, portable-spelling assertions) |
| `testResultGoldBrowser` (real Chrome, 4 layouts) | **11 checks, 0 failures** |
| `testRa1TutorialInputBrowser` | **16 / 16** |
| `testRa1ResultArtCoverageBrowser` | **56 / 56** (8 playable heroes × portrait, 34 weapons, phases, layouts) |
| `testRa1FighterArtCoverageBrowser` | **135 / 135** (4 viewports × BOT/LOCAL, all 14 entries) |
| `testRa1CompatibilityBrowser` | **145 / 145** (18 rows × viewport/language/mode) |
| `testRa1NestedItchHostingBrowser` | **13 / 13** |
| `testCp4CombatIntelligenceGate`, `testCp3MasteryGate`, `testLocalizationGate`, `testMobileEntryArchitecture`, `testItchGuestReleaseGate` | PASS |
| Production build + `testShippingDist` + `testProductionSourceHygiene` + `testResultGoldAuthority` | PASS (480 assets, 75 665 014 B) |

---

## 5. Device compatibility (RA-1.E)

Real integrated app, ENG + VIE, touch at every phone/tablet width and mouse+keyboard at desktop:

`320×568`, `360×560`, `390×844`, `667×375`, `844×390`, `1284×692`, `1440×900`.

Per row the gate asserts: zero page-level horizontal overflow, zero clipped visible text,
FREE BATTLE / mode cards / LOCK reachable and hit-tested, hero preview decoded, live battle
HUD identity readable with **0 px** overlap against HP, ESC always leaves the match, and zero
console errors. Additional rows: LOCAL 2P at 360×560 and 390×844; a live orientation change on
the pick screen (390↔844) with LOCK still hittable.

Curated screenshots: `docs/acceptance/ra1/compatibility/` (home / fighter / battle at 320, 390,
667 landscape, 844 landscape incl. a live rotation, 1284 and 1440, ENG and VIE) plus the full
machine-readable `compatibility-matrix.json` for that run. The HUD and tutorial close-ups are in
`docs/acceptance/ra1/assets/`, nested-hosting evidence in `docs/acceptance/ra1/nested/`.

---

## 6. Nested itch hosting (RA-1.E)

Local `/html/apex/` nest built from `tools/packItchPortable.mjs` (portability gate: 91 files,
475 literals made relative). Verified in the nested frame: boot → Home → VS BOT → Fighter
(preview decoded from the nested base) → live battle HUD with decoded skill icons → ESC back to
a reusable pick screen → parent-sealed Result payload with **both portraits and the weapon art
decoded** → reload with the guest save intact. **0 first-party 404, 0 exceptions, 0 external hosts.**

---

## 7. BOT match duration (RA-1.D — investigation, no rule change)

Method: real BOT matches in the real browser (production AI on the CPU side, the player side left
to the same fighter state a non-inputting player produces), advanced with the product's own
`APEX_ARSENAL.step(dt)` so physics/AI/damage/cooldowns are identical. Raw data:
`docs/acceptance/ra1/bot-duration-9matches.json` (per-match duration, HP, winner, sealed ledger).

9 natural pairings (`newbot:newbot`, `newbot:hunter`, `newbot:crystala`, `newbot:magnet`,
`newbot:frost`, `boxe:hunter`, `frost:frost`, `magnet:magnet`, `crystala:magnet`):

| Metric | Value |
|---|---|
| Resolved | 9 / 9 |
| Median | **86.5 s** |
| p90 | **139.2 s** |
| Max | **139.2 s** |
| Unresolved at 180 s / 300 s | **0 / 0** |
| Termination | KO only (`state.over` sealed, `resultGold` produced, winner side recorded) |

**Finding:** the old audit’s “>220 s NEWBOT mirror without an end” **did not reproduce** in any of
the nine runs; the longest match was 139.2 s. The match still has **no authored time limit or draw
rule** — the clock counts up and only a KO ends it, which is a real (if unexercised here) tail risk.

**Recommendation for owner (NOT implemented):** an optional cap with a fair resolution, e.g. at
180 s resolve by remaining HP (higher HP wins, exact tie = draw), announced on the HUD clock from
the start. Any of that changes gameplay/result rules (AC/missions/sealed mastery), so it stays
blocked pending approval.

---

## 8. Not reproduced / not verified

- **SEL-2** (Fighter Select missing preview) — not reproducible with any of the 14 entries at
  320/390/844/1440 in BOT or LOCAL. Owner-observed cases were most likely the near-black
  `LOCKED` state (by design) or the 1-frame swap animation.
- **B3** (Result P1 column crop at 390 px) — the settled state is inside the viewport at every
  tested layout; the earlier capture was a mid-choreography frame.
- **Physical devices** — iOS Safari, Samsung Internet, low-end Android: **UNVERIFIED** (emulation only).
- **Real-device FPS** — not measured (out of RA-1 scope).

---

## 9. Remaining risks

1. No match time limit (see §7) — tail risk of long stalemates in unusual pairings.
2. HUD fix is CSS-scoped to `[data-quest != 1]` compact BOT; a future HUD band change must re-run
   `testGoldBattleHudAdaptationGate` and the browser label-fit matrix.
3. `appAssetPath()` is the single gate for Result art identity: new art roles must live under
   `assets/` and use a supported spelling.
4. BOT duration evidence is 9 pairings; a much larger sample could still find a >300 s outlier.

---

## 10. Decisions reserved for the owner

1. **Match-time rule** — implement the cap/draw (and its effect on AC/missions/sealed mastery) or accept KO-only termination. *Blocked pending approval.*
2. **HUD structure** — the two compact-BOT rules above are the minimum that removes the overlap; confirm the 320 px portrait removal is acceptable (it is the only way to keep the full opponent name in that band).
3. **Release packaging** — merge/deploy/publish remain owner-gated; nothing here touches `main`, production or itch.

*Measurement vs judgment: PASS = gate + visual evidence at this HEAD; UNVERIFIED = emulation-only or no physical device; FAIL = reproduced and still open. No assertion was loosened to make CI green.*
