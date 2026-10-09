# B0.5 — Responsive R90 -> Quest01 SHA-pinned integration gate

Date 2026-10-09. **Integration research and reproducible rehearsal ONLY.** No live merge, no deploy, no Quest runtime edits, no owner source branches changed.

## Verified inputs

| Side | Ref | Pinned SHA | Status |
|---|---|---|---|
| Responsive feature candidate | `arena/r90-independent-hud-gate-audit` | `19a780dfa7880db418330f324ff0d1bc98f84869` | Descends from R89 font/cleanup; 5 newer commits are **tests/docs only**, not approved HUD feature repairs. Isolated R90 audit CI SUCCESS run 37882835158. Global Arsenal Product Acceptance FAIL run 37882835415 (R77 Chrome Home portrait hitbox gate). |
| Responsive accepted mechanism | `arena/r89-gold-responsive-runtime` | `c941ecf0ad7df321265ac69d21a6e8493a49d567` | R89 Gold Responsive Resolver SUCCESS run 37877292855. |
| Responsive typography/cleanup | `arena/r89-font-parity-quest-merge-prep` | `60fec477997d913e04cd3f3a1441b90465aacf62` | Independent R89 font+cleanup CI SUCCESS run 37880136684; full global acceptance still red run 37880136657. |
| Quest gameplay | `quest/q5y-e05-charge-from-q5x` | `799b80820ef0a6e9cce7563258da66dfa0db3519` | Q5 E01–E05 desktop/mobile Chrome SUCCESS run 37896478833; gameplay presentation requires the 2026-10-09 owner corrections. |
| Quest audit | `quest/q5-owner-feedback-audit-20261009` | `0058c18c89818675f4e53dc8945f4e767ca70869` | Pure owner-response audit, no gameplay edits. |
| Divergence point | common ancestor | `53cb5b48b14d24d2bcc596a3ca5e4a54704a44dc` | Compare endpoint confirms both histories diverged from this commit. |

## Exact overlap and hidden dependency

GitHub compare of **common ancestor -> Q5** (230 commits, 73 changed files) versus **common ancestor -> R90** (186 commits, 49 changed files) yields **exactly TWO paths changed on both sides**:

- `public/gold/shell.html` — Quest story/Gold routing plus responsive shell, with **embedded Battle HUD Base64 payload**. Old R89/Q4E read-only rehearsal run 37879331525 confirmed this file had content conflict.
- `public/gold/battle-hud.html` — Quest HP/identity/team projection markup/CSS versus responsive native Gold layout fixes. Old rehearsal showed this file auto-merged structurally but could still be semantically wrong.

Other responsive changes (47 files unique against Quest), including `src/App.jsx`, `src/main.jsx`, `index.html`, `src/game/goldFontParity.css`, `public/gold-fidelity-profiles.mjs`, `src/game/bootStartViewportGuard.js`, `src/game/mobileViewportAudit.js`, `tools/buildGoldCutover.mjs` and test workflows, must be retained **without wholesale overriding Quest**.

**Never choose ours/theirs for whole Shell/HUD**. Reconcile Battle HUD authored source first, regenerate `battleHudPayload` from exact resulting bytes, reconcile Shell story/transition logic + responsive presentation, re-run `buildGoldCutover --check` and the rendered payload equality gate. The generated output MUST be reproducible by canonical generator. Never manually splice Base64.

## Plan placement: B0.5, not B3 or B8

This is a **hard integration dependency between B0 forensic audit and B1 core combat**. In the existing plan, replace `B0 -> B1` with `B0 -> B0.5 -> B1 -> B2 -> B3 -> ... B8`.

- **B0.5a** Freeze responsive and Quest SHAs; run Git three-way `merge-tree` read-only; record status + exactly two shared files. Current workflow below does this for pinned Q5/R90.
- **B0.5b** Create an *isolated throwaway/integration branch* starting at current Quest audit SHA; integrate R90 descendant preserving all Quest runtime features. Explicitly resolve two authored files and regenerate embedded Gold HUD from canonical merged source/generator.
- **B0.5c** **BOTH** gate sets must run on the integrated tree: R89 viewport/color/font/pick, 360×560, 375×667, 550×857, 667×375, 1024×768, 820×1180, 1180×820, 16:9 desktop, rotate/resume, START/transition, original `?goldViewport=native`; AND Quest E01–E05 real Gold Chrome, signed checkpoints, result, save/reload, plus Free Battle regression and compiled shipping dist. Record known pre-existing red gates separately; do not silence by test deletion/weakening. User's observed tablet aesthetics require a real screenshot review.
- **B0.5d** Promote integrated HEAD as **the sole parent of B1–B8 new work**, leaving frozen Q5 and R90 owner branches untouched, only after source/build coherence and regression evidence. Do **not** merge into main/Cloudflare here.
- **B3 remains Quest-specific arena-first + seamless HP + replay hub.** B0.5 preserves Gold native responsive profile and sets the foundation; B3 must NOT rewrite R89 resolver or inject a second whole-viewport scaler. Build a Quest-only presentation policy inside the R89 design space, then cross-test all profiles.
- **B8 final** gets only target-branch refresh/QA/shipping, NOT the first responsive merge. Otherwise late-stage divergence multiplies cost/risk.

## Not yet passed; still owner work

R90 specifically documents unresolved R62 tablet BOT dock, R63 tablet BOT skill visibility and R65 ACTIVE/CD visual artwork. R90 independent SUCCESS refers to the **inventory** and R52/R81 Pick checks; global acceptance is not green. Those are tracked Gold owner backlog, NOT an excuse to replace accepted Gold geometry or call Quest responsive final.

Likewise, Q5 gameplay has not yet adopted the new collision, enemy skill/speed, T1/T2, arena-priority, story or motion corrections. Keep these in B1–B5, AFTER integration.

## Safety/invariants

- No direct changes to R90, R89, frozen Q5, responsive production deployment, or main.
- Never treat responsive/Quest viewport equality across radically different device classes as a promise; verify **same existing Gold family** and exact aspect behavior.
- If owner-responsive branch moves while Quest integration is active, pin new SHA and rerun overlap/reconciliation, not silent rebasing.
- Responsive outer layout vs Quest inner arena is layered: an R89-accurate outer viewport can still show an overly small inner Quest arena; this is precisely B3's separate task.

## Actual read-only Q5/R90 three-way receipt
- GitHub Actions run **37902041236** SUCCESS in **research/report validation**, NOT successful product merge.
- Input SHAs exactly as pinned above; ancestor `53cb5b48b14d24d2bcc596a3ca5e4a54704a44dc`.
- Actual `git merge-tree --write-tree --messages` exit **1** => **MANUAL_RECONCILIATION_REQUIRED**.
- Shared modified files: **exactly `public/gold/battle-hud.html` and `public/gold/shell.html`**, unchanged from static REST comparison.
- Therefore B0.5 is a **required** merge-resolution stage before any B1/B3 Quest changes; do not claim R90 integrated or Q5+Responsive tests complete.
- Workflow deliberately exits success on expected conflict to preserve evidence; next gate must demand a clean resolved *integrated* tree and visual/browser tests.
