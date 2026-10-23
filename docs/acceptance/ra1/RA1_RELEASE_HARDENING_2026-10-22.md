# RA-1 — Release Hardening Report (2026-10-22)

**Scope:** RA-1 only. No RA-2..RA-4 work.
**Starting baseline:** `7ecc7f65fc5c0822fd5b257e27e58e9894f15f22`.
**Exact product/test target:** `856cdf48247aa752b377eb2ddb6071426cf6e494` (`arena/d7ff52e8-apex-chaos`, revision `20261021-cp5-r1`).
**PR:** #101, Draft / Open.
**Decision:** **CONDITIONAL — exact-SHA external evidence is closed; awaiting owner acceptance review; not OWNER ACCEPTED.** No merge, production deploy, itch publish, redesign, or gameplay-rule change was performed.

The release-critical browser/package checks now run against the exact target SHA on an externally reachable, isolated Cloudflare Pages preview. The live build receipt identifies 70 versioned runtimes; runtime revision and selected asset bytes match the locally built exact-SHA candidate. Production's receipt stayed unchanged before and after the preview deploy. The report/evidence-only delivery commits do not alter application runtime or gameplay sources.

## 1. Verdict and conditions

The RA-1 UI, tutorial, asset delivery, BOT/LOCAL compatibility, and nested-hosting gates pass at the target SHA. No new product defect was reproduced in this verification pass. The decision remains **CONDITIONAL**, not unconditional release approval, because:

1. **KO-only match law remains an owner decision.** All 27 BOT matches across the three separate samples resolved naturally, but the game still has no time limit or draw rule. No timeout/draw change was made.
2. **Legacy Netlify START gate remains red, but its current availability failure is classified.** The exact-SHA Cloudflare preview is independently live and passes external browser acceptance. A read-only probe of the older Netlify URL returned HTTP 404; the original gate assertion remains unchanged and is still failing. This is a separate provider/preview-entrypoint issue, not a Cloudflare exact-SHA result.
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
| DUR-1 | P1 investigation | BOT match duration | No KO timeout/draw is authored; clock counts up. | No gameplay or reward rule changed. | Separate samples: production 9/9 median 57.1 s (p90/max 90.8); dev replication 9/9 median 84.7 s (p90/max 124.6); exact Cloudflare preview 9/9 median 48.9 s (p90/max 143). All resolved naturally. **OWNER DECISION / OPEN** |

### Live Battle HUD identity/HP measurements

Real integrated BOT battles used the production `setBotOpponent` authority. In both 320×568 and 390×844, identity was measured against the P2 HP element. HUNTER, NEWBOT, and the longer playable name CRYSTALA were each readable, fully inside the viewport, and had `scrollWidth - clientWidth = 0`; identity/HP intersection area was **0 px²** in all six cases. The compact rail duplicate is `display:none` as intended. Font is Oswald (12 px at 320×568, 14 px at 390×844).

- Machine-readable exact-SHA geometry: `hud-identities/hud-identity-matrix.json`.
- Screenshots: [`320×568 HUNTER`](hud-identities/320x568-en-hunter.png), [`320×568 NEWBOT`](hud-identities/320x568-en-newbot.png), [`320×568 CRYSTALA`](hud-identities/320x568-vi-crystala.png), and equivalent 390×844 images in `hud-identities/`.
- Full integrated compatibility gate also confirms the live NEWBOT identity across all requested viewport/language rows.
- **External exact-SHA check:** run `39735511402` measured HUNTER, NEWBOT, and CRYSTALA at 390×844, 844×390, and 320×568: **9/9 PASS**, with zero console errors, zero failed network requests, no identity/HP overlap, and 9 screenshots. The complete browser artifact is linked in the [final evidence index](RA1_FINAL_EVIDENCE_INDEX_2026-10-22.md).

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
| Live Battle HUD HUNTER/NEWBOT/CRYSTALA identity geometry | Sandbox exact build **6/6**; external exact-SHA preview **9/9 PASS** across 390×844, 844×390, 320×568; 0 console/network failures and 0 px² HP overlap |
| BOT duration investigation | **Three separate samples:** production median 57.1 s; dev replication median 84.7 s; external exact preview median 48.9 s. All 9/9 KO-resolved; no timer/draw rule added |

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

The three datasets below are **separate samples and are not pooled**. All matches were observed through the real production runtime and resolved by KO; the external preview sample is an additional independent run, not a replacement for either recorded production or dev set.

| Sample | Run/environment | Matches | Median | p90 | Max | Unresolved |
|---|---|---:|---:|---:|---:|---:|
| Production build (primary production evidence) | `bot-duration-production.json`, port 4173 | 9/9 | **57.1 s** | 90.8 s | 90.8 s | 0 at 180/300 s |
| Dev-server replication (independent) | `bot-duration.json`, Vite development server | 9/9 | **84.7 s** | 124.6 s | 124.6 s | 0 at 180/300 s |
| External exact-SHA preview (additional) | Run `39735511402`, Cloudflare preview | 9/9 | **48.9 s** | 143 s | 143 s | 0 |

The spread is natural match-state/run variation. These observations do not prove every possible pairing terminates quickly.

**Current rule:** Arsenal ends on KO only. There is no authored match cap, draw, or sudden-death rule; the HUD clock counts up. The owner must decide whether to retain this rule or explicitly authorize a gameplay/result/reward change. No proposal was implemented; AC, missions, cooldowns, damage, and sealed mastery were not changed.

## 6. CI, exact-SHA preview, and provenance

- **Runtime tested:** `856cdf48247aa752b377eb2ddb6071426cf6e494`, revision `20261021-cp5-r1`. PR #101 remains **Draft/Open**. Current evidence-only branch HEAD is `d209c81e31473e5101678ea1d049f837be3ff4a5`; it adds QA workflow/tooling and docs only, not a different runtime candidate.
- **External exact-SHA preview:** [https://ra1-exact-856cdf4.apex-chaos.pages.dev](https://ra1-exact-856cdf4.apex-chaos.pages.dev), isolated Pages branch `ra1-exact-856cdf4`. Workflow [39735511402](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39735511402) passed. The live root returned HTTP 200; `CP16_BUILD_RECEIPT.json` identified the exact target SHA/revision and 70 versioned runtimes; Gold shell and selected runtime byte digests matched the exact local build. The production receipt before/after was unchanged. This is an isolated preview, not production deployment.
- **External browser evidence:** the same workflow opened the public URL in real headless Chrome and passed Tutorial 16/16, Result art 56/56, Fighter Select 136/136, compatibility 145/145, live HUD identity 9/9, nested itch-style package 13/13, and nine BOT matches. Final artifact: [run #39735511402 artifacts](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39735511402#artifacts) (43.3 MB; 30-day retention). Machine-readable summary and probe are also mirrored in [PR comment](https://github.com/Khanh-glitch/APEX-CHAOS/pull/101#issuecomment-6334800151).
- **Legacy `actual-preview-entrypoint` remains failed; diagnosis is a stale/unavailable Netlify preview origin.** The PR check [39737455095, job 119686419578](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39737455095/job/119686419578) passed its local production Chrome/Netlify-like provider test, then failed at “Verify main-facing PR's deployed Netlify START entrypoints.” A read-only probe from the successful Cloudflare runner to the same configured Netlify root, `https://deploy-preview-101--apexchaos.netlify.app/`, returned **HTTP 404** (`curl_exit=0`). The legacy browser script first asserts that navigation returned a successful HTTP response before it checks START visibility, geometry, hit testing, image decode, or click-through. Therefore the current probe establishes a missing/404 Netlify preview entrypoint; it does **not** establish a Cloudflare/product defect. Exact browser-specific failure telemetry for the old Netlify run remains unavailable, so the 404 probe is the direct present-time cause evidence, not an assertion-level trace of that earlier attempt. No assertion was weakened, skipped, or removed; the Netlify gate remains red and is not being represented as passing.
- The pre-existing Pages URL `https://arena-d7ff52e8-apex-chaos.apex-chaos.pages.dev/` still belongs to a different stale deployment and is not used as exact-SHA evidence. Arena preview port 4173 is also sandbox-only and not evidence for the external URL.
- **RA-2 note:** the gun-pick reminder can still appear while the tutorial is paused. Recorded for RA-2 only; it was not redesigned or changed in RA-1.
- Physical iOS Safari, Samsung Internet, and low-end Android device checks remain **UNVERIFIED**. Browser acceptance here uses headless Chromium/touch emulation.

## 7. Remaining risk and owner decisions

1. Decide whether to retain indefinite KO-only match termination, or separately authorize a timeout/draw/sudden-death rule and its AC/mission/sealed-mastery consequences. **Blocked; not implemented.**
2. Review the narrow compact-BOT HUD fix, including hiding the redundant portrait at ≤340 px. No broader layout/art/typography/flow redesign was made.
3. Review the externally reachable exact-SHA Cloudflare preview and evidence artifact. The separate legacy Netlify START gate remains red on HTTP 404; its assertion is unchanged.
4. Physical iOS/Samsung/low-end Android acceptance remains unverified.
5. Keep the tutorial gun-pick reminder during pause in the RA-2 defect queue; do not treat this RA-1 as a tutorial redesign.

**No production deploy, PR merge, itch publish, owner acceptance, timeout/draw law, or gameplay/balance/reward change occurred.** Existing sandbox screenshot evidence is committed under `docs/acceptance/ra1/`; the new external-preview screenshots and diagnostics are in the linked 43.3 MB GitHub Actions artifact. Video was not recorded.
