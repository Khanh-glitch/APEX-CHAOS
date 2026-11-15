# GitHub Issue `#103` — Final `itch.io` Alpha Readiness Gate Report

- **Issue**: `#103` — `[FINAL ITCH ALPHA GATE] Fix portrait coach/toast overlap and verify Guest 200 AC nested gameplay`
- **Branch**: `arena/99851aa2-apex-chaos`
- **Parent Baseline Commit**: `5b5ea5b3b4567d5cbbe7f36a333aa631ebbaf430` (`Issue #102` acceptance commit; CI run `39952548634` `50/50` `SUCCESS`)
- **PR `#101` Status Preserved**: `OPEN` + `Draft` at head `c8f5ebed` (untouched per owner instruction)
- **Publish / Package Boundary**: **Strictly NOT published** — `.github/workflows/itch-guest-200ac-release-candidate.yml` was **NOT** triggered, Cloudflare was **NOT** deployed, and **`0` `.zip` archives** were created or uploaded prior to explicit owner approval.
- **Readiness Verdict**: **`READY FOR OWNER VISUAL ACCEPTANCE`** *(explicitly holding back `READY TO PUBLISH ITCH ALPHA` until owner visual sign-off and approved ZIP packaging)*.

---

## 1. Root Cause Analysis

### 1.1 P0.1 — Portrait Simultaneous Coach + Achievement Toast Overlap (`390×844` & `320×568`)
1. **`GAMEPLAY_BLOCKERS` omission (`src/ui/AchievementToast.jsx`)**:
   - `findSafeToastDock()` checked `#arena`, `#arenaCanvas`, `#p1Side .skill`, `#p1Side .weapon`, `#p2Side .skill`, `#p1Rail`, `#p2Rail`, and `#matchCenter`, **omitting `.apex-coach-chip`, `.apex-coach-skip`, and `.apex-guide-pickup-prompt`**.
   - On `390×844` portrait, when Tactical Pulse battle coach was active (`top: 537..611.48px`), `findSafeToastDock()` selected `top: 589.98..639.98px` (`mode = safe-dock`) right above P1's skill deck (`646px`), overlapping `.apex-coach-chip` by **`4,882.87 px²` (`ENG`)** / **`5,186.13 px²` (`VIE`)** and obscuring the coach instruction text (`3,133.60 px²` / `3,336.77 px²`).
2. **Portrait fallback CSS specificity & missing compact-portrait `is-arena-edge` (`src/ui/AchievementToast.jsx`, `src/ui/achievementToast.css`)**:
   - Once `.apex-coach-chip` occupies the mid-HUD slot (`537..611px`) on `390×844` and `320×568` portrait, zero non-arena safe gaps remain (`best === null`).
   - `is-arena-edge` previously activated only for `shortLandscape` (`height <= 500`), leaving `compactPortrait` hidden (`data-visual-pending="true"`) on `320×568` AND allowing portrait media-query rules (`.apex-achievement-toast[data-owner-side="P1"]`, specificity `(0,2,1)`) to override `.apex-achievement-toast.is-arena-edge` (`bottom: calc(var(--apex-p1-deck-h, 198px) + ...)` vs `top: var(--apex-arena-toast-top)`).
3. **Dynamic coach mount/step relocation & `320×568` right-edge clamp + menu entrance keyframe (`src/ui/FirstPlayGuide.jsx`, `src/ui/AchievementToast.jsx`)**:
   - If an achievement toast appeared *before* `.apex-coach-chip` mounted or advanced steps (e.g. `First Blood` earned during `K ACTIVE` while coach is hidden, followed by coach remounting at `06-match-j-castable-with-target`), `AchievementToast` needed synchronous layout-pass re-docking (`syncObservedBlockers(); applyDock(); place();` on `apex:coach-layout-changed` `CustomEvent` dispatched from `FirstPlayGuide` `useLayoutEffect`) without attaching a `MutationObserver` to `document.body` during 60 FPS combat HUD updates — eliminating even a 1-frame (`16.7ms`) safe-dock flash overlap.
   - On `320×568`, `computeBattleFrame()` fallback clamped `left` to `Math.round(rect.left)` (`80 + 250 = 330px > 320px`, clipping `10px` right). Clamping fallback `left` to `Math.min(vw - fallbackWidth - 8, Math.round(rect.left))` keeps `.apex-coach-chip` strictly inside `[8px, 312px]` (`coachInViewport = true`, `0px` clip).
   - `computeMenuFrame()` previously relied on inline `transform: translateY(-100%)`, which was temporarily overridden by `@keyframes apex-coach-chip-in { to { transform: translateY(0) } }` on initial Mode Select paint (`390×844`). Computing exact `chipTop = rect.top - gap - chipHeight` with `chipTransform: 'none'` eliminates first-paint overlap with `.modeCard[data-mode="bot"]`.

### 1.2 P0.2 — `itch.io` Guest `200 AC` Economy, One-Time Idempotency & Nested `/html/apex/` Audit
- **`src/config/releasePolicy.js`**: `GUEST_ONLY_RELEASE = true`; Google OAuth, email magic code, and cloud sync remain compiled closed when built with empty Supabase/Auth env vars (`passwordInputs = 0`, `emailInputs = 0`, `oauthButtons = 0`, `externalUrls = []`).
- **`src/progression/storage.js` + `src/progression/rewards.js` + `src/integration/goldProductBridge.js`**:
  - Starter guest wallet = **`350 AC`** (`1/8` owned fighters: `NEWBOT`/`ROBOT`).
  - Legitimate `BOT` win (`winnerSide === 'P1'`) awards **`+200 AC`** (`350 -> 550 AC`); `BOT` loss awards `+25 AC`; `LOCAL` match awards `+50 AC`.
  - Duplicate seal replay on the same `matchId` / `productResultAwarded === true` returns `{ ok: false, reason: 'not-awardable', balance: 550 }` (`0` duplicate payout across repeated calls and full browser reloads).
  - Invalid/unrecognized modes (`null`, `'LAB'`, `'TRAINING'`) and BOT feats (`ownerKind: 'bot'`, `walletEligible: false`) yield `0 AC` and `0` permanent human Mastery mutations.
- **Tooling & portable-packaging bugs caught and closed**:
  - `tools/packItchPortable.mjs`: fixed a live `itch.io` nested-path 404 in desktop Chromium where `<link rel="icon" href="./gold/assets/gold/favicon-r72-owner.png?v=r72">` in `dist-itch-html5/index.html` was re-resolved against post-mount `<base href="./gold/">` as `/html/apex/gold/gold/assets/gold/favicon-r72-owner.png` (`404`) upon head/scene mutation; an inline pre-`<base>` `<head>` pin locks entry `<link href>` URLs to their resolved `<entry>/...` targets while preserving portable relative attributes on disk and keeping canonical `dist/` untouched.
  - `tools/testItchNestedChrome.mjs`: parameterized hardcoded `/usr/bin/google-chrome` with `process.env.CHROME_PATH || '/usr/bin/google-chrome'`.
  - `tools/testRa1NestedItchHostingBrowser.mjs`: narrowed legacy intro close selector to `.apex-guide-close:not(.apex-coach-skip)` so Home entry preserves active Tactical Pulse coach step `1/6` -> battle step `4/6` inside `/html/apex/index.html`.
  - `tools/auditItchNestedCandidateE2e.mjs` *(new)*: local temporary nested `/html/apex/index.html` HTTP server + SHA receipt verification + hard zero-ZIP guard + full `testItchNestedChrome` + `testRa1NestedItchHostingBrowser` (`390×844` portrait) + full touch phone (`844×390`) & desktop (`1440×900`) `start -> selection -> live BOT match -> Result Gold -> Continue return -> reload persistence` E2E verification without touching Cloudflare or building any `.zip`.

---

## 2. P0.1 Measured DOM Telemetry — `BEFORE` (`5b5ea5b3`) vs `AFTER` (Simultaneous Coach + Toast)

| Case | `BEFORE` (`5b5ea5b3`) Toast Box / Mode | `BEFORE` Coach Overlap | `AFTER` Toast Box / Mode | `AFTER` Coach Chip Box | Coach Copy / Body / `SKIP` Overlap | Hit-Target & Gameplay Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`390×844` `ENG`** *(coach -> toast & toast -> coach)* | `{8, 590, 237.1, 640}` (`safe-dock`) | **`4,882.87 px²`** (`copy: 3,133.60 px²`) | `{10, 108, 228, 142.5}` (`arena-edge`) | `{10, 537, 350, 611.5}` | **`0 px²` / `0 px²` / `0 px²`** | `pointer-events: none`, `SKIP` `56×44` unoccluded, `tutorialPaused: false` |
| **`390×844` `VIE`** *(coach -> toast & toast -> coach)* | `{8, 590, 251.4, 640}` (`safe-dock`) | **`5,186.13 px²`** (`copy: 3,336.77 px²`) | `{10, 108, 228, 142.5}` (`arena-edge`) | `{10, 537, 350, 611.5}` | **`0 px²` / `0 px²` / `0 px²`** | `pointer-events: none`, `BỎ QUA` `75.3×44` unoccluded, `tutorialPaused: false` |
| **`320×568` `ENG`** *(coach -> toast & toast -> coach)* | `pending` (hidden; `5,920 px²` vs Skill 1) + coach right `330 > 320` | Toast suppressed + **`10 px` viewport clip** | `{10, 88, 228, 122.5}` (`arena-edge`) | `{62, 331.5, 312, 406}` | **`0 px²` / `0 px²` / `0 px²`** | `coachInViewport: true`, `SKIP` `56×44` unoccluded, `tutorialPaused: false` |
| **`320×568` `VIE`** *(coach -> toast & toast -> coach)* | `pending` (hidden; `5,920 px²` vs Skill 1) + coach right `330 > 320` | Toast suppressed + **`10 px` viewport clip** | `{10, 88, 228, 122.5}` (`arena-edge`) | `{62, 307.9, 312, 406}` | **`0 px²` / `0 px²` / `0 px²`** | `coachInViewport: true`, `BỎ QUA` `75.3×44` unoccluded, `tutorialPaused: false` |
| **`844×390` `ENG`** *(preserved)* | `{342, 50, 560, 84.5}` (`arena-edge`) | `0 px²` | `{342, 50, 560, 84.5}` (`arena-edge`) | `{684, 212.5, 836, 331.7}` | **`0 px²` / `0 px²` / `0 px²`** | `arena = 338×338`, `SKIP` `134×44` unoccluded |
| **`844×390` `VIE`** *(preserved)* | `{342, 50, 560, 84.5}` (`arena-edge`) | `0 px²` | `{342, 50, 560, 84.5}` (`arena-edge`) | `{684, 195.1, 836, 331.7}` | **`0 px²` / `0 px²` / `0 px²`** | `arena = 338×338`, `BỎ QUA` `134×44` unoccluded |

---

## 3. P0.2 Nested `/html/apex/index.html` & Guest `200 AC` E2E Summary

- **Portable Rewriter Receipt**: `ITCH PORTABILITY PASS: 91 text files scanned, 30 transformed, 475 URL literals made relative`
- **Local Temporary Nested Server**: `http://127.0.0.1:<ephemeral>/` -> `<iframe src="/html/apex/index.html">` (`1,826` HTTP requests served, **`0` 404/500 responses**, **`0` external host requests**, **`0` page/console errors**)
- **Sub-Gates Passed Inside Nested `/html/apex/index.html`**:
  1. `node tools/testItchNestedChrome.mjs`: **`PASS` (`exit 0`)** — Guest `350 -> 550 AC`, zero auth UI, portable URLs verified.
  2. `node tools/testRa1NestedItchHostingBrowser.mjs` (`390×844` touch portrait): **`PASS` (`15 pass, 0 fail`, `exit 0`)** — boot -> Home -> VS BOT -> Fighter Select hero preview -> live battle -> non-blocking Tactical Pulse `4/6` lesson & `SKIP` persistence -> `ESC` exit -> canonical Result Gold art decode -> reload guest save intact.
  3. `844×390` Phone Touch Full E2E (`nested-844x390-phone-touch-*.png`): **`PASS`** — `350 AC` starter -> real BOT match -> Result Gold `VICTORY` -> `Continue` (`254.9×44 px`) -> `550 AC` (`+200 AC`), duplicate seal `not-awardable` (`550 AC`), `LAB`/bot feat `0 AC`, reload `550 AC` intact.
  4. `1440×900` Desktop Full E2E (`nested-1440x900-desktop-*.png`): **`PASS`** — `350 AC` starter -> real BOT match (`attempt 1`) -> Result Gold `VICTORY` -> `Continue` (`310×52 px`) -> `550 AC` (`+200 AC`), duplicate seal `not-awardable` (`550 AC`), reload `550 AC` intact.

---

## 4. Actions Explicitly Held Back Behind Owner Approval

1. **Triggering `.github/workflows/itch-guest-200ac-release-candidate.yml`**: Held back — that workflow runs `npx wrangler pages deploy dist --project-name apex-chaos --commit-dirty=true` and uploads a release `.zip` artifact.
2. **Creating or uploading `apex-chaos-itch-html5-*.zip`**: Held back — **`0` `.zip` archives** exist in the workspace or git tree.
3. **Advancing or un-drafting PR `#101` (`c8f5ebed`)**: Held back — PR `#101` remains `OPEN` + `Draft` untouched.

---

## 5. Evidence Index (Committed in `evidence/issue-103-final-alpha-gate-20261023/`)

- `before/before-metrics.json` & `before/before-{390x844,320x568,844x390}-{eng,vie}-coach-toast.png`
- `after/runtime-qa-report.json`, `after/after-{390x844,320x568,844x390}-{eng,vie}-coach-toast.png`, `after/390x844-port-02-mode-select.png`, `after/390x844-port-06-match-j-castable-with-target.png`, `after/390x844-port-08-result-gold.png`, `after/844x390-land-06-match-j-castable-with-target.png`, `after/844x390-land-08-result-gold.png`
- `itch-nested/itch-nested-candidate-report.json`, `itch-nested/nested-tutorial-paused-390x844.png`, `itch-nested/nested-result-390x844.png`, `itch-nested/nested-844x390-phone-touch-{02,04,05,06}*.png`, `itch-nested/nested-1440x900-desktop-{02,05,06}*.png`
