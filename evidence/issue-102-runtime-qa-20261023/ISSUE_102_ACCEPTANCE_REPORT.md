# Issue #102 — Runtime Revision Gate Repair, Real Production-Preview Chromium QA & P2 Visual Acceptance Evidence

- **Status:** `READY FOR OWNER VISUAL ACCEPTANCE` _(NOT merged, NOT deployed, NO `itch.io` ZIP built/uploaded, NO Cloudflare publish)_
- **Target Branch:** `arena/99851aa2-apex-chaos` (fast-forward push ONLY: `ed1dc16981e897e6599bc193444cd80789cc5a7e -> 5b5ea5b3b4567d5cbbe7f36a333aa631ebbaf430`, **no `--force`**, **no rebase onto `2b7b1a7`**)
- **Final Commit SHA:** [`5b5ea5b3b4567d5cbbe7f36a333aa631ebbaf430`](https://github.com/Khanh-glitch/APEX-CHAOS/commit/5b5ea5b3b4567d5cbbe7f36a333aa631ebbaf430)
- **Runtime Revision:** `'20261023-tp-r1'` (`70` versioned runtime entries sealed atomically across `src/game/runtimeManifest.js`, `tools/testRuntimeRevisionGate.mjs`, `.github/workflows/ra2-exact-sha-preview.yml`, `tools/runtimeRevision.lock.json`, `public/gold/{battle-hud.html,shell.html,manifest.json}`, and `src/game/goldAssetManifest.js`)
- **GitHub Actions Receipt (Final SHA):** [`Arsenal Product Acceptance` · Run `#39952548634`](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39952548634) (`job_id=120410309737`, `headSha=5b5ea5b3b4567d5cbbe7f36a333aa631ebbaf430`, **`50/50` steps `SUCCESS`**, `failedSteps=[]`, uploaded artifact `arsenal-product-acceptance` `id=12501843001`, `246,398,222` bytes)
- **PR #101 State Verified:** [`PR #101`](https://github.com/Khanh-glitch/APEX-CHAOS/pull/101) remains `OPEN`, `isDraft: true`, unmerged, `headRefName: arena/d7ff52e8-apex-chaos` (`c8f5ebeddbebb7e9781b171c019fe0ceb3a07842` untouched)

---

## 1. Root Cause Audit & Fixes Applied

### P0 — Runtime Revision Gate & CP16 Atomic Cache Authority (`39935961419` -> `39940290141` -> `39952548634`)
1. **Why CI failed on `d5f425b4`, `1048522f`, and `ed1dc169`:**
   - Tactical Pulse HUD B intentionally modified 4 versioned `public/game/` files (`public/game/core/apexArsenalProductRenderHudRuntime.js`, `public/game/gold/goldProductBridge.js`, `public/game/hero-rework/heroReworkRuntime.js`, `public/game/hero-rework/robotPresentationRuntime.js`), while `APEX_RUNTIME_REVISION` remained `'20261021-cp5-r1'` and `tools/runtimeRevision.lock.json` still held pre-Tactical-Pulse SHA-256 hashes.
   - Because `APEX_RUNTIME_REVISION` stamps every `?v=<revision>` runtime URL AND `testCP16AtomicRelease.mjs` enforces 3-way equality (`src/game/runtimeManifest.js` + `tools/testRuntimeRevisionGate.mjs` + `.github/workflows/ra2-exact-sha-preview.yml` + `public/gold/manifest.json` + `src/game/goldAssetManifest.js` + `tools/runtimeRevision.lock.json`), modifying those 4 files without advancing the revision string and regenerating Gold + lockfile would also break immutable cache-busting on cached clients.
2. **Line-by-line provenance audit of all 4 modified `public/game/` runtime files before resealing:**
   - `public/game/core/apexArsenalProductRenderHudRuntime.js` (generated from `tools/goldBattleHudTacticalPulse.mjs` via `node tools/buildGoldCutover.mjs`): Verified intentional Tactical Pulse HUD B snapshot serializer (`__targetMissing`, `__mitigationPct`, `__questSlotLocked`, `arenaViewportRect`, `firstBloodCoach`).
   - `public/game/gold/goldProductBridge.js` (generated from `tools/buildGoldCutover.mjs`): Verified intentional postMessage bridge forwarding `arenaViewportRect` and `firstBloodCoach` (`questMode` + `pauseActive`) to React `BattleScreen.jsx`.
   - `public/game/hero-rework/heroReworkRuntime.js`: Found and removed one leftover unused variable (`const questSlotLocked = ...`) inside `buildSkillHudSnapshot`; preserved `getSkillHudState(..., matchState)` and `__targetMissing` / `__mitigationPct` telemetry.
   - `public/game/hero-rework/robotPresentationRuntime.js`: Found one subtle mobile polish bug where `ctx.font` on canvas skill callouts skipped `calloutScale` (`Math.round(fontPx)` instead of `Math.round(fontPx * calloutScale)`), making canvas combat callouts `8px` tiny on high-DPR mobile; fixed cleanly before sealing.
3. **Atomic reseal & new CI step:**
   - Bumped revision to `'20261023-tp-r1'` across all authority files, ran `node tools/buildGoldCutover.mjs`, sealed all `70` runtime SHA-256 hashes in `tools/runtimeRevision.lock.json` (`embeddedBytes: 156667`, `embeddedSha256: dd865cea18bf42e2841b171c4cc1f992017d64e54aacdc448ed12aa6e17265a843`), kept 100% of hash assertions in `tools/testRuntimeRevisionGate.mjs` + `tools/testCP16AtomicRelease.mjs` untouched, and added Step 45 in `.github/workflows/arsenal-product-acceptance.yml` so GitHub Actions executes `testCP16AtomicRelease.mjs`, `testGoldRevisionIntegrityGate.mjs`, `testCP16BuildReceipt.mjs`, AND `auditTacticalPulseRuntimeQa.mjs` against real `pnpm preview` on every push.

### P1 — Real Production-Preview Chromium E2E, Portable `puppeteer-core`, & Live-Clock Tutorial Race Fix
1. **Portable `puppeteer-core` without root workspace bloat:**
   - Verified `createRequire` fallback in `tools/auditTacticalPulseRuntimeQa.mjs` (`import('puppeteer-core')` -> `tools/probe/package.json`) resolves `tools/probe/node_modules/puppeteer-core` cleanly **with zero root `node_modules/puppeteer-core`** both locally and on fresh Ubuntu CI runners.
2. **Hardened `tools/auditTacticalPulseRuntimeQa.mjs` against real `pnpm build` + `pnpm preview`:**
   - Fixed Step 8 KO wait loop not to spam `A2` (`Virtual Armor`, `-55%` damage mitigation) on cooldown while waiting for organic 2-round KO under software WebGL, cutting full 4-viewport runtime QA to ~`9m` on 2-vCPU CI hardware with 100% organic combat completion.
   - Extended `auditTacticalPulseRuntimeQa.mjs` with `auditPortraitMiniSkillLabels(...)` across `390×844` & `320×568` (`ENG` + `VIE`) so CI directly asserts `clipPx === 0` and zero vertical clip on opponent mini-skill chips.
3. **Real Chromium tutorial race uncovered & fixed in `testRa1TutorialInputBrowser.mjs` & `testRa2PickupHintBrowser.mjs`:**
   - Because Tactical Pulse Coach holds **zero pause lease** (`pause = false`), `page.screenshot(...)` takes `~1.2–1.5s` of live match clock during which autonomous fighters can collect the floor gun that made `taughtSlot` equal `"0"` pre-screenshot, flipping live `taughtSlot` to `"1"`. Re-reading live `taughtSlot` immediately after screenshot / before tap eliminated the stale-slot flake across `ENG` + `VIE` touch & keyboard runs while keeping all assertions (`assert.notEqual(lesson2.taughtSlot, slot1Used)`, `18/18` RA-1 checks) completely intact.

### P2 — Narrowly Scoped UX Polish & Quantitative Acceptance Evidence (Zero Style Overhaul)
1. **P2.1 `390×844` & `320×568` Portrait BOT Mini-Skill Label (`…TUAL ARMOR` -> Full Unclipped 2-Line Chip):**
   - **Fix applied (`tools/goldBattleHudTacticalPulse.mjs` only):** Scoped strictly to `#hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p2Side .sk-name`: enabled clean 2-line wrapping (`white-space:normal; max-width:66px` at `390px` and `max-width:76px` at `<=340px`, `padding:2px 2px 0; line-height:1.1`) and bounded `#p1Side .sk-art` height on `820×1180` portrait tablet.
   - **Arena & HUD invariants preserved:** `390×844` arena remains **`378×378px`** (`0px` delta); `320×568` arena remains **`252×252px`** (`0px` delta); `testBattleHudLabelFitBrowser.mjs` passed **`154/154`** checks (`0` failures, `maxTileOv=3`).
2. **P2.2 `844×390` Short-Landscape Result Gold (`Continue` Below Fold in `.ac-root`):**
   - Verified owner-canonical Result Gold layout untouched: `.ac-root` (`844×390`, `horizOverflowPx = 0`), fixed bottom hint `.ac-scroll-hint` (`"SCROLL DOWN FOR CONTINUE"`, `display: "grid"`, `pointerEvents: "none"`, `rect = {left:0, top:362, right:844, bottom:390}`), pre-scroll `Continue` below fold (`top = 451..495`, `height = 44px`), native 8-step touch swipe on `.ac-root` (`scrollTop: 0 -> 219`, `scrollExtent = 232`), post-scroll `Continue` hit target `{x: 294.55, y: 219, width: 254.89, height: 44}` (`>= 44×44px` standard), tapped via `page.touchscreen.tap(421.99, 241)` returning cleanly to Fighter Select (`09-returned-fighter-select.png`).
3. **P2.3 `844×390` Short-Landscape `First Blood` Ribbon (`is-arena-edge`):**
   - Verified `AchievementToast.jsx` untouched: `.apex-achievement-toast.is-compact.is-arena-edge` (`pointerEvents: "none"`, `hitThroughTarget: "canvas#game-canvas"`), bounding box `{left: 342, top: 50, right: 560, bottom: 84.47, width: 218, height: 34.47}` tucked cleanly at top-left inside `arenaBox = {left: 338, top: 46, right: 676, bottom: 384}`, **`0` overlap pixels** against `p1Skill0`, `p1Skill1`, `p1Weapon`, `p2Skills`, `versusRail`, and `coachSkip`, `titleHorizClipPx = 0`.

---

## 2. Quantitative Before vs After Table (P2.1 Portrait Opponent Mini-Skill Labels)

| Viewport & Locale | Arena Box (`Before -> After`) | Fighter Name (`cw / sw`) | Chip 0 Text & Fit (`ed1dc169 Before -> 5b5ea5b After`) | Chip 1 Text & Fit (`ed1dc169 Before -> 5b5ea5b After`) |
| :--- | :--- | :--- | :--- | :--- |
| **`390×844` ENG** | `378×378 -> 378×378` (`0px` change) | `NEWBOT` (`108 / 108`, `0` clip) | `WEAPON DASH`: **`sw=87 > cw=64` (`+23px` ellipsis)** -> **`cw=66, sw=66, clipPx=0`** (`height=17px`) | `VIRTUAL ARMOR`: **`sw=95 > cw=64` (`+31px` `…TUAL ARMOR`)** -> **`cw=66, sw=66, clipPx=0`** (`height=17px`) |
| **`390×844` VIE** | `378×378 -> 378×378` (`0px` change) | `MAGNETA` / `NEWBOT` (`0` clip) | `BÀN TAY TỪ TÍNH` / `LƯỚT VŨ KHÍ`: **`sw=100 > cw=64` (`+36px` clip)** -> **`cw=66, sw=66, clipPx=0`** | `GIÁP ẢO` / `KHIÊN TỪ`: **`cw=61, sw=61, clipPx=0`** |
| **`320×568` ENG** | `252×252 -> 252×252` (`0px` change) | `NEWBOT` (`59 / 59`, `0` clip) | `WEAPON DASH`: **`sw=87 > cw=64` (`+23px` clip)** -> **`cw=76, sw=76, clipPx=0`** | `VIRTUAL ARMOR`: **`sw=95 > cw=64` (`+31px` clip)** -> **`cw=76, sw=76, clipPx=0`** |
| **`320×568` VIE** | `252×252 -> 252×252` (`0px` change) | `CRYSTALA` (`68 / 68`, `0` clip) | `KHO VŨ KHÍ PHẢN CHIẾU`: **`sw=145 > cw=64` (`+81px` clip)** -> **`cw=76, sw=76, clipPx=0`** | `KIẾN TẠO THÍCH ỨNG`: **`sw=124 > cw=64` (`+60px` clip)** -> **`cw=76, sw=76, clipPx=0`** |

---

## 3. Command Receipt Matrix — Local Pass vs GitHub Actions Pass (with Separate Console Warning Column)

| Gate / Suite | Command | Local Exit Code | GitHub Actions (`#39952548634`) | Non-Blocking Console / Build Warnings |
| :--- | :--- | :---: | :---: | :--- |
| Gold Cutover Parity Check | `node tools/buildGoldCutover.mjs --check` | `0` (`PASS`) | `SUCCESS` (Step 11) | None |
| Runtime Revision Lock Gate | `node tools/testRuntimeRevisionGate.mjs` | `0` (`70/70 PASS`) | `SUCCESS` (Step 11) | None |
| CP16 Atomic Cache Authority | `node tools/testCP16AtomicRelease.mjs` | `0` (`PASS`) | `SUCCESS` (Step 45) | None |
| Gold Revision Integrity (`18/18`) | `node tools/testGoldRevisionIntegrityGate.mjs` | `0` (`18/18 PASS`) | `SUCCESS` (Step 45) | None |
| Embedded Battle HUD Parity | `node tools/testGoldEmbeddedHudParity.mjs` | `0` (`PASS`) | `SUCCESS` (Step 30) | None |
| Battle HUD Live Truth (`20/20`) | `node tools/testBattleHudLiveTruthGate.mjs` | `0` (`20/20 PASS`) | `SUCCESS` (Step 30) | None |
| Battle HUD Adaptation + R90 | `node tools/testGoldBattleHudAdaptationGate.mjs && node tools/auditR90BattleHudGate.mjs` | `0` (`actualFailures=[]`) | `SUCCESS` (Step 30) | None |
| Production Bundle + Pruned Dist + CP16 Receipt | `pnpm build && pnpm test:shipping-dist && node tools/testCP16BuildReceipt.mjs` | `0` (`480` files, `0` leaks, SHA `5b5ea5b...`) | `SUCCESS` (Steps 35–37, 45) | Pre-existing Vite chunk note on `src/game/cosmetics/ecoNewbotV17Gold.js` (dynamic + static import; exit `0`) |
| Battle HUD Label Fit Browser (`154` checks) | `node tools/testBattleHudLabelFitBrowser.mjs` | `0` (`154 pass, 0 fail`, `maxTileOv=3`) | `SUCCESS` (Step 43) | Headless CPU WebGL fallback warning only (`ReadPixels` software rasterizer; `0` page errors) |
| **Tactical Pulse 4-Viewport + VIE + Portrait Mini-Label E2E (`pnpm preview`)** | `node tools/auditTacticalPulseRuntimeQa.mjs` | `0` (`844×390`, `1440×900`, `900×900`, `390×844`, `1v1 VIE`, `4` Portrait 1P viewports) | `SUCCESS` (Step 45) | `0` `pageerror`; expected headless CPU WebGL software-rasterizer notice only |
| Result Gold Multi-Viewport Browser | `node tools/testResultGoldBrowser.mjs` | `0` (`4` viewports, `0` failures) | `SUCCESS` (Step 42) | None |
| RA-1 Tutorial Input Browser (`18/18`) | `node tools/testRa1TutorialInputBrowser.mjs` | `0` (`18 pass, 0 fail`) | `SUCCESS` (Step 43) | None |
| RA-2 Pickup Hint + Toast Presentation + Release Blocker | `testRa2PickupHintBrowser` + `testRa2ToastPresentationBrowser` + `testRa2ReleaseBlockerToastBrowser` | `0` (`ENG` + `VIE` touch & keyboard `PASS`, `0` uncaught errors) | `SUCCESS` (Step 43) | None |
| Alpha Home + Skill Details + R81/R90 Home Portrait + R50K Gold Cutover | `testAlphaHomeBrowser` + `testSkillDetailsBrowser` + `testHomePortraitBrowser` + `testGoldCutoverBrowser` | `0` (`100% PASS`) | `SUCCESS` (Steps 14, 41, 43) | None |

---

## 4. Visual Evidence Index (`evidence/issue-102-runtime-qa-20261023/`)

- `runtime-qa-report.json`: Complete machine-readable bounding-box, scroll delta, hit-target, and overlap telemetry across all viewports.
- `before-after/before-metrics.json` + `before-after/p2-before-*.png` vs `before-after/p2-after-*.png`: Exact Chromium pixel comparisons for `390×844` & `320×568` (`ENG` + `VIE`) portrait BOT HUD & cropped top strips.
- `844x390-land-04b-achievement-ribbon.png`: Short-landscape `First Blood` `is-arena-edge` ribbon non-overlap & canvas click-through proof.
- `844x390-land-08-result-gold.png` -> `844x390-land-08b-result-continue-reachable.png` -> `844x390-land-09-returned-fighter-select.png`: Short-landscape Result Gold pre-scroll `SCROLL DOWN FOR CONTINUE` cue, post-native-swipe `Continue` (`254.89×44px` at `y=219`), and native `touchscreen.tap` return to Fighter Select.
- `CP16_BUILD_RECEIPT.json`, `ci-run-39952548634-jobs.json`, `ci-run-39952548634-artifacts.json`: Exact SHA `5b5ea5b3b4567d5cbbe7f36a333aa631ebbaf430` build and GitHub Actions receipts.
