# RA-1 — Release Hardening Report (2026-10-22)

**Scope:** RA-1 only. No RA-2..RA-4 work.
**Starting baseline:** `7ecc7f65fc5c0822fd5b257e27e58e9894f15f22`.
**Exact product/test target:** `856cdf48247aa752b377eb2ddb6071426cf6e494` (`arena/d7ff52e8-apex-chaos`, revision `20261021-cp5-r1`).
**PR:** #101, Draft / Open.
**Decision:** **CONDITIONAL — ready for owner acceptance review; not OWNER ACCEPTED.** No merge, production deploy, itch publish, redesign, or gameplay-rule change was performed.

This continuation reran the release-critical browser/package checks against the exact target SHA. The exact build receipt reports 70 versioned runtimes. The screenshots and machine-readable results below are tied to the tested SHA. The report/evidence-only delivery commit, if one is added, does not alter application or test sources.

## 1. Verdict and conditions

The RA-1 UI, tutorial, asset delivery, BOT/LOCAL compatibility, and nested-hosting gates pass at the target SHA. No new product defect was reproduced in this verification pass. The decision remains **CONDITIONAL**, not unconditional release approval, because:

1. **KO-only match law remains an owner decision.** Nine BOT matches resolved naturally, but the game still has no time limit or draw rule. No timeout/draw change was made.
2. **External preview proof is incomplete.** The local isolated production build is exact-SHA and available in the Arena QA preview (port 4173); the existing Cloudflare Pages preview still reports the old SHA. The PR's external Netlify START-entrypoint CI step failed, and its logs/artifact could not be retrieved from the Actions blob host (EOF), so its cause is **UNVERIFIED**.
3. **Physical-device checks remain UNVERIFIED.** Browser tests use headless Chromium with touch emulation; iOS Safari, Samsung Internet, and low-end Android hardware were not available.
4. **Owner acceptance is pending.** This report does not imply OWNER ACCEPTED or permission to merge/deploy/publish.

## 2. Defect register

| ID | Severity | Surface | Reproduction / root cause | Technical change in the RA-1 candidate | Exact-SHA evidence / verdict |
|---|---|---|---|---|---|
| HUD-1 | P1 | Compact portrait BOT Battle HUD | At 390×844, the duplicated P2 rail name intruded into the HP strip by about 12×11 px. | Hide only the duplicate `#p2Rail .vr-name` in `[port][compact][1p]`; keep the identity card. | Before/after crops: `assets/hud-p2-identity-before-320x568-crop.png`, `assets/hud-p2-identity-after-320x568.png`, `assets/hud-p2-identity-after-390x844.png`. Live HUNTER/NEWBOT/CRYSTALA: 6/6 pass, 0 px identity/HP overlap. **FIXED / PASS** |
| HUD-2 | P1 | ≤340 px portrait BOT identity | At 320×568, the redundant portrait covered the end of the duplicated name inside a 70 px rail. | Hide only the redundant portrait in that compact BOT band; preserve Local/landscape/Quest. | Same before/after evidence; current exact-SHA 320×568 identity matrix. **FIXED / PASS** |
| TUT-1 | P1 | First-play coach, touch and keyboard | Input copy was chosen once from `(pointer: coarse)`, so a hybrid device could touch while being taught “Press J.” | Coach copy follows the last real pointer input plus the live media-query change; touch and keyboard actions remain accepted. Presentation only. | Exact-SHA `testRa1TutorialInputBrowser`: 16/16. Screens: `assets/tutorial-touch-exact-390x844.png`, `assets/tutorial-touch-skip-exact-390x844.png`, `assets/tutorial-hybrid-exact-390x844-vie.png`, `assets/tutorial-keyboard-exact-1280x800.png`. Pause lease, taught-skill cast, SKIP, keyboard J, and pagehide recovery all pass. **FIXED / PASS** |
| RES-1 | P1 | Result Gold under nested itch path | Result art accepted only exact `/assets/` paths. Portable packaging rewrites paths to `../assets/`, causing dictionary-art fallback/404. | `appAssetPath()` accepts safe `/`, `./`, `../`, and bare first-party asset spellings while rejecting traversal/protocol/non-image values. No Result redesign. | Exact-SHA Result art matrix 56/56; nested test decodes SHURI + NEWBOT portraits and SHOTGUN with no placeholders and zero first-party 404. `nested/nested-result-390x844.png`. **FIXED / PASS** |
| SEL-1 | P2 | Fighter Select pager | Previously measured from scrollport edge rather than the CSS snapport inset. | Pager/controller uses computed `scroll-padding-left` (present in candidate before this QA rerun). | Existing pager gate 29/29; exact-SHA Fighter Select art/pick gate 136/136, including page-follow case. **FIXED / PASS** |
| SEL-3 | P3 | Fighter Select rejected move | Old assertion expected a locked-neighbor move to change page even though selection was correctly rejected. | Assertion distinguishes rejected move from a successful selection; page-follow is separately proven by selecting NEWBOT on the next page. | `fighter-selection-follow-390x844.png`; exact-SHA coverage 136/136. **HARNESS CORRECTED / PASS** |
| SEL-2 | — | Fighter Select art | No missing playable art reproduced. Six future fighters remain deliberately locked. MIRROR has no pose before an opponent is picked. | No new change. Lock state and MIRROR law are preserved. | Exact-SHA coverage: every playable card/preview decodes; locked entries stay locked; MIRROR gets real opponent art only after pick. **NOT REPRODUCED / PASS** |
| DUR-1 | P1 investigation | BOT match duration | No KO timeout/draw is authored; clock counts up. | No gameplay or reward rule changed. | Nine exact-SHA pairings, 9/9 KO-resolved; median 84.7 s, p90/max 124.6 s, none unresolved at 180/300 s. **OWNER DECISION / OPEN** |

### Live Battle HUD identity/HP measurements

Real integrated BOT battles used the production `setBotOpponent` authority. In both 320×568 and 390×844, identity was measured against the P2 HP element. HUNTER, NEWBOT, and the longer playable name CRYSTALA were each readable, fully inside the viewport, and had `scrollWidth - clientWidth = 0`; identity/HP intersection area was **0 px²** in all six cases. The compact rail duplicate is `display:none` as intended. Font is Oswald (12 px at 320×568, 14 px at 390×844).

- Machine-readable exact-SHA geometry: `hud-identities/hud-identity-matrix.json`.
- Screenshots: [`320×568 HUNTER`](hud-identities/320x568-en-hunter.png), [`320×568 NEWBOT`](hud-identities/320x568-en-newbot.png), [`320×568 CRYSTALA`](hud-identities/320x568-vi-crystala.png), and equivalent 390×844 images in `hud-identities/`.
- Full integrated compatibility gate also confirms the live NEWBOT identity across all requested viewport/language rows.

## 3. Exact-SHA test and package matrix

### Build/runtime/package gates

The production build receipt is `dist/CP16_BUILD_RECEIPT.json` (commit `856cdf…`, revision `20261021-cp5-r1`, 70 versioned runtimes). The shipping distribution contains 480 files with zero first-party leaks. Source hygiene reports 75 production runtimes, 34 quarantined, 5 retired/orphaned, and zero stale pointers.

| Gate | Exact result |
|---|---|
| Runtime revision | PASS |
| CP16 build receipt | PASS |
| CP16 atomic release | PASS |
| Shipping distribution | PASS — 480 files, 0 leaks |
| Production source hygiene | PASS — 0 stale pointers |
| Result Gold authority | PASS — 47 owner titles |
| Gold revision integrity | PASS — 18 checks |
| Gold Battle HUD adaptation | PASS — 61 checks |
| Gold Pick Band law | PASS — 87 checks |
| Gold Battle HUD label fit, real Chromium | **154/154**, 144 primary label probes, max skill/weapon tile internal overflow 3 px |

### RA-1 browser/device/hosting gates

| Gate | Exact result |
|---|---|
| Tutorial touch/keyboard/pause/SKIP/recovery | **16/16 PASS** |
| Result/Fighter Select art delivery | **56/56 PASS** (playable portraits, C weapon atlas, decode, fallback tags, viewports) |
| Fighter Select full roster + picking + MIRROR/lock laws | **136/136 PASS** on standalone exact-SHA rerun |
| Compatibility: 320×568, 360×560, 390×844, 667×375, 844×390, 1284×692, 1440×900; ENG/VIE; BOT/LOCAL; touch/keyboard | **145/145 PASS** across 18 rows; no clipping/page overflow, all first-party network requests successful, no console errors |
| Nested itch `/html/apex/` package | **13/13 PASS**; 0 first-party 404, 0 exceptions, 0 external hosts |
| Live Battle HUD HUNTER/NEWBOT/CRYSTALA identity geometry | **6/6 PASS**, 0 name overflow, 0 px² HP overlap |
| BOT duration investigation | **9/9 naturally KO-resolved**; no timer/draw rule added |

The Fighter Select art script had one earlier development-server run abort at a later mode-card press because its expected visible selector was absent. The same gate was immediately rerun standalone and completed 136/136 without assertion edits, then passed 136/136 again against the exact-SHA production preview. A separate focused development-server HUD attempt needed a repeated touch once at 390×844; diagnostics showed `stage=ready`, the visible Home control still present, and no coach overlay. This did **not** recur in the exact-SHA production-preview run (6/6). These remain recorded as **unresolved development-harness input/transition timing flakes**, not silently waived product failures. No root cause was proven; assertions were unchanged, and production-view compatibility passed 145/145.

### Visual, font, asset and performance observations

- Compatibility matrix: `compatibility-matrix.json`; curated screenshots: `compatibility/`.
- Result art coverage: `result-coverage-matrix.json`; images decode across 390×844, 844×390, and 1440×900, with no first-party request failures.
- Fighter art: `fighter-art-matrix.json`; 42 actual playable-preview swaps (excluding MIRROR’s intentional no-pose state) have median decode/commit 437 ms, p90 941 ms, max 948 ms. MIRROR’s no-image-before-opponent behavior is **EXPECTED BY DESIGN**, not a slow or missing asset.
- Live HUD label-fit gate measured 144 longest-name/skill/weapon probes in ENG/VIE; zero horizontal elision and max internal tile overflow 3 px.
- Physical-device FPS and low-end hardware performance were not measured: **UNVERIFIED**.

## 4. Nested itch-style delivery

`tools/packItchPortable.mjs` passed against the exact target after the normal guest-candidate receipt step was reproduced locally: 91 text files scanned, 30 transformed, 475 URL literals made relative. The local-only `dist/ITCH_GUEST_BUILD_SHA.txt` contains the exact target SHA; it was generated in ignored build output and is not a release/publish action.

The real packaged output was served inside a host iframe at `/html/apex/` and driven through boot → Home → BOT → Fighter Select → live Battle HUD → ESC back to reusable Fighter Select → parent-sealed Result → reload. Fighter preview, both Result portraits, and SHOTGUN art decoded under the nested base. The Guest save remained available. Zero first-party 404s, JavaScript exceptions, and external-host requests.

## 5. BOT duration — investigation only, no rule change

Raw exact-SHA data: [`bot-duration-production.json`](bot-duration-production.json) (production preview on port 4173) and [`bot-duration.json`](bot-duration.json) (independent Vite development-server replication). Both runs advanced the real production runtime with `APEX_ARSENAL.step(0.025)`; durations below are **simulated game seconds**, not wall-clock runtime. P1 was left in its autonomous no-input state. No BOT AI, physics, damage, cooldown, or timer authority was changed.

**Primary production-build sample (9 pairings):**

| P1 | BOT | Duration | Winner | Sealed |
|---|---|---:|---|---|
| NEWBOT | NEWBOT | 53.2 s | P2 | Yes |
| NEWBOT | HUNTER | 75.5 s | P1 | Yes |
| NEWBOT | CRYSTALA | 90.8 s | P1 | Yes |
| NEWBOT | MAGNET | 43.2 s | P2 | Yes |
| NEWBOT | FROST | 85.1 s | P2 | Yes |
| BOXE | HUNTER | 57.1 s | P2 | Yes |
| CRYSTALA | NEWBOT | 45.8 s | P2 | Yes |
| HUNTER | BOXE | 55.9 s | P2 | Yes |
| SHURI | MAGNET | 86.7 s | P2 | Yes |

Production sample: 9/9 resolved; median **57.1 s**; p90/max **90.8 s**; 0 unresolved at 180 s or 300 s. The independent development-server sample also resolved 9/9 (median 84.7 s, p90/max 124.6 s). Across all 18 observed rounds: median 63.4 s, p90 113.9 s, max 124.6 s; no round remained unresolved at 180/300 s. The variation is natural match-state/run variation; the production sample is the primary release evidence. This does not prove every possible pairing terminates quickly.

**Current rule:** Arsenal ends on KO only. There is no authored match cap, draw, or sudden-death rule; the HUD clock counts up. The owner must decide whether to retain this rule or explicitly authorize a gameplay/result/reward change. No proposal was implemented; AC, missions, cooldowns, damage, and sealed mastery were not changed.

## 6. CI, exact-SHA preview, and provenance limits

- PR #101 remains Draft/Open at exact target SHA `856cdf48247aa752b377eb2ddb6071426cf6e494`.
- GitHub run `39725400631`, job `119648027460` (`actual-preview-entrypoint`): local production build and provider-injection Chrome step **PASS**; the later external deployed-Netlify START-entrypoint step **FAIL** with exit code 1. Job metadata confirms the failure step; its log and diagnostic artifact downloads returned EOF from the Actions result/blob host. Therefore the external step’s root cause is **UNVERIFIED**, not attributed to the product or environment.
- The existing Pages preview `https://arena-d7ff52e8-apex-chaos.apex-chaos.pages.dev/` still serves receipt SHA `7ecc7f65fc5c0822fd5b257e27e58e9894f15f22`; it is **not** exact-SHA evidence.
- An isolated local production build from the exact target is available in the Arena QA live preview on port **4173**; verify `/CP16_BUILD_RECEIPT.json` for `856cdf…`. It does not deploy to Cloudflare, Netlify, production, or itch. No external exact-SHA isolated URL was verified.
- The nested itch fixture on port 4180 is local test infrastructure only; it is not a published itch page.

## 7. Remaining risk and owner decisions

1. Decide whether to retain indefinite KO-only match termination, or separately authorize a timeout/draw/sudden-death rule and its AC/mission/sealed-mastery consequences. **Blocked; not implemented.**
2. Review the narrow compact-BOT HUD fix, including hiding the redundant portrait at ≤340 px. No broader layout/art/typography/flow redesign was made.
3. Review the exact-SHA local QA preview and screenshots. The external Netlify preview check remains unverified and the old Pages receipt is stale.
4. Physical iOS/Samsung/low-end Android acceptance remains unverified.

**No production deploy, PR merge, itch publish, owner acceptance, timeout/draw law, or gameplay/balance/reward change occurred.** Screenshot evidence is committed under `docs/acceptance/ra1/`; video was not recorded.
