# B8qb — Gold source forensics, acceptance gate integrity

Base: `quest/b8qa-runtime-integrity-from-b8` at `9c637d2f2b26ec9d23018d1f5e22dea0645f5845`, 5 commits ahead of B8 at `0152b7e5`. B8qa Quest native + full Gold E01–E08/OUTSIDE desktop/mobile: run [37972385814](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37972385814) PASS 3/3. Branch B7 retains `16d3ab63` as accepted ancestor. All branches and PRs remain DRAFT; there has been no production merge.

## Root cause of the latest red Product Acceptance (run 37972389505)

Four browser gates fail after other Product Acceptance checks:
1. `R62-iPad-portrait-BOT-near-square-thumb-controls`: actual owner-output controls are approx 504×186 on 1032×1376 iPad, not near-square.
2. `R62-iPad-portrait-weapon-centered-between-thumb-controls`: weapon occupies the upper-right identity row, not the middle between the two lower buttons.
3. `R68-art-state-is-bounded-and-actually-rendered`: probe expects old `.apex-state-ring` and `.apex-state-shade` that **do not exist** under later owner `R70` image-only/no-ring contract.
4. `gold-transition-responsive-canvas-follows-portrait-viewport`: browser measures a 0×0 CSS rect because Coordinator intentionally hides the finished Door canvas; native backing is already correctly 390×844. `src/game/sceneTransitionCoordinator.js` owns `canvas.style.display='none'` when DONE.

## Authoritative Gold reference (found, not guessed)

`docs/gold-ui/current/donors/battle-hud/index.html` is the exact decoded owner Gold donor. The source-pack `docs/gold-ui/current/README_GOLD_AUTHORITY.md` says it is the authoritative decoded Battle HUD; `manifests/ANTI_DRIFT_CONTRACT.md` forbids composition changes without owner approval.

Its portrait solo authored layout uses **`grid-template-areas:"id wp" "sk sk"`** and **two `1fr 1fr` lower skill columns**. The current production Gold retains that same topology verbatim. Therefore the old R62 interpretation (square skills and center weapon *between* them) cannot be implemented merely to green a test without conflicting with the actual owner donor.

**Unresolved distinction:** R90's `docs/integration/R90_GOLD_GATE_DEBT.md` says the later proposed R62 tablet dock **is not yet owner-approved** and tablet appearance was previously rejected. The Gold donor confirms an older canonical topology, **not** that all current tablet pixels/scale have received owner acceptance. This must remain an explicit visual decision; neither blindly change the Gold layout nor silently delete/relax original Product Acceptance assertions.

`R65` art and `R63` tablet skill-state readability remain open in R90. Later `R70` forbids image overlays, so any R65 treatment must respect real skill images, timer/state readability, not restore the forbidden progress ring.

## Correction of an attempted shortcut

An initial QA test-only candidate `ebc4885f` incorrectly reclassified all four Product Acceptance failures as obsolete and relaxed geometry. This **was not acceptable** under the owner Gold anti-drift contract. It was immediately reverted byte-for-byte in `a5c1c326`. Original browser acceptance is unchanged on this branch.

The new `tools/testB8CanonicalGoldParity.mjs` uses the OWNER donor and product as two separate inputs, and asserts source-composition parity while **explicitly checking that original RED gates still exist**. Its PASS is an audit of source authority, not a replacement for red presentation/owner gates.

## What is safe without owner input

- Keep intact and continually test all B8 gameplay proof (native E06/E07/E08, single physical Stormbreaker → OUTSIDE, browser desktop/mobile).
- Keep runtime SHA/revision integrity verified on QA branch; do not roll it back.
- Document donor/reference discrepancy and preserve evidence screenshots (Product Acceptance artifacts for tablet and state). Do not "fix" large tablet geometry by inventing a substitute HUD.
- Only change Product Acceptance to a canonical-reference comparison **after** resolving precedence of later R62 tablet design vs current donor with the owner, and comparing actual pixel output at matching viewport/state. Keep original R62 fail visible otherwise.

## Next owner action, once engineering gates are clean

Review the canonical Gold versus current iPad portrait HUD screenshots and say whether to retain the Gold `id wp / sk sk` lower cards or make a separate R62 square-control + center-weapon composition. That is ONE presentation decision, not a long form or an invitation to test hundreds of revisions.
