# SLIME Crash-Recovery Closeout (2026-09-29)

**Session branch:** `arena/01a0e90e-apex-chaos`
**Recovery authority:** `docs/hero-rework/phase1/15_SLIME_CRASH_RECOVERY_AND_CLOSEOUT_2026-09-29.md`
(`director/slime-crash-recovery-20260929` @ `696170b004e90585ea65a93a493037ab9533ba32`)
**Gameplay laws still in force:** doc 14
(`docs/hero-rework/phase1/14_SLIME_OWNER_CORRECTION_PASS_2026-09-28.md`).
Where doc 14 would have required rebuilding lost screenshot infrastructure or redoing durable
C1–C3 work, doc 15 overrode it, and this session obeyed doc 15.
**Scope:** recover → verify durable C1–C3 → run existing regressions → production build →
push → report. No redesign, no rebalance, no new capture framework.

**Note on numbering:** this file is numbered `16_` because `15_` on this lineage is already the
C4 final report (`15_SLIME_OWNER_CORRECTION_FINAL_REPORT_2026-09-28.md`). The recovery authority
doc 15 lives on the `director/slime-crash-recovery-20260929` branch only.

## Recovery

- Fresh workspace started grafted on `main` (`ac28079`); `git status` clean, no local work.
- Fetched remote; inspected durable refs:
  - `arena/01a0e749-apex-chaos` = `84d386337d97ed4575a0cf476ecf05ec54321660`
    (`chore(arsenal): refresh real-browser evidence [skip ci]`, evidence-bot)
  - `safety/pre-slime-crash-recovery-20260929` = `af649ab63a9b933c40280bd9f6a9f4a670616a70`
    (matches doc 15 §1 exactly)
  - `director/slime-crash-recovery-20260929` = `696170b004e90585ea65a93a493037ab9533ba32`
    (matches authority commit exactly)
- Session branch `arena/01a0e90e-apex-chaos` was reset to the durable tip `84d3863`
  (== interrupted-branch tip; contains C1–C3 + C4 report + one evidence refresh).
- **Recovered starting SHA:** `84d386337d97ed4575a0cf476ecf05ec54321660`
- Recovery refs `safety/pre-slime-crash-recovery-20260929` and
  `director/slime-crash-recovery-20260929` were not modified.

## Durable C1–C3 verification (verified, NOT reimplemented)

| Checkpoint | Expected SHA | Found | Production surface (spot-checked present) |
|---|---|---|---|
| C1 body-aware weapon rendering | `67d55896f73f5a6d094fe3ba06b4f4b4b04bfed7` | ✓ exact | `HR.extraLivingBodies()` (`heroReworkRuntime.js:125`); `drawEquippedWeapons()` enumerates `fighters[]` + extras (`arsenalQuestRuntime.js:534`) |
| C2 Storm floor body enumeration | `35a6862e2060faa5ed449fba1d02163665c61c0e` | ✓ exact | `HR.environmentTargets()` (`heroReworkRuntime.js:143`); floor-contact caller uses it (`arsenalQuestRuntime.js:335`) |
| C3 local HP + heading + corner diagnostic | `4a13807ac94d665088ada07a82afa5f020bb9bb7` | ✓ exact | `HR.bodyLocalHpIndicators` (`heroReworkRuntime.js:151`); `sourceBody` heading law (`heroReworkRuntime.js:522`); merge `70521026` intact |
| C4 final report (prior session) | `29ffec9ae9d43245d6484577a39b0c2e8519023f` | ✓ present | doc 15 of this lineage; its verification claims were independently re-run below |

Behavioral proof came from the existing gates (next section), not from re-reading diffs.

## Targeted verification results (this session, existing tooling)

`npm install --no-package-lock` (107 packages), then:

| Suite | Command | Result |
|---|---|---|
| SLIME owner-fix gates G1–G7 (C1–C3) | `node tools/testHeroReworkSlimeOwnerFixGates.mjs` | **7/7** |
| SLIME physics gates S1–S8 | `node tools/testHeroReworkSlimeGates.mjs` | **9/9** |
| SLIME kit gates S9–S13 | `node tools/testHeroReworkSlimeKitGates.mjs` | **5/5** |
| SLIME legacy separation L1–L6 | `node tools/testHeroReworkSlimeLegacySeparation.mjs` | **6/6** |
| ROBOT gates R1–R9 | `node tools/testHeroReworkRobotGates.mjs` | **9/9** |
| Hero Rework smoke | `node tools/smokeHeroReworkHeadless.mjs` | **17/17** |
| Hero Rework goldens | `node tools/testHeroReworkGoldens.mjs` | **11/11** |
| Arsenal headless | `node tools/testArsenalQuestHeadless.mjs` (after `materializeArsenalFinalSfx.mjs`) | **334/334** (run twice, both green) |
| Production build | `generatePublicAssetManifest.cjs` (690 assets) + `vite build` | **clean** (`dist/` in 1.85s) |

No assertions were weakened. No product code was changed.

## Regressions / anomalies classified (no product fix justified)

1. **Committed evidence-bot report showed 333/334; this session measures 334/334.**
   The durable tip's `docs/arsenal-quest/evidence/headless-test-report.json` records one failure:
   `force-reveal-at-3.0-not-autopickup` (evidence-bot CI run). Both runs in this session pass that
   gate (`"pass":true`). Classification: **known timing-flake family** (same class as the
   documented `both-unarmed` / `owner-cp6-input-alive-during-warmup` warmup-input flakes), outside
   SLIME scope, not a product regression. No fix.
2. **Report telemetry drift across environments (same commit, all gates green):**
   `survivorHp` 23.1→39.8 (S10 report), `smoke-robot-dash-moves-to-pickup` moved 152→296, golden
   traj ±1–3px, re-rendered evidence PNG bytes. Classification: **environment-dependent telemetry**,
   not a code regression — identical commit, all assertions hold. Regenerated evidence files were
   **restored** (not committed); evidence refresh remains owned by the evidence-bot pattern.
3. **No other failure in any suite.** Zero real regressions found → zero product commits.

## Real bugs discovered and root-cause fixes

**None.** No new product bug was found, so no product commit was manufactured.

## Did the second corner-stuck bug reproduce?

**No.** G6 re-ran in this session: 35 runs / 5 deterministic seeds (4311–4315) × scenarios
{a2-double-spawn, passive-emergency, edge-start ×4, corner-drive}, `anyViolation: false`,
max stationary run 1–3 frames everywhere; corner-drive returns bodies to the arena
(2 corner frames → 204 in-arena frames). Matches the C4 verdict: the owner report is fully
explained by the pre-fix default-left heading. No speculative movement fix was added.
Normal APEX inertia + collision/bounce remains the movement authority; no steering added.

## Survivability observations (diagnostic only — NO tuning)

G7 re-measured through the real `weaponApi.aqDamage` path, identical to C4:
A1 1000 → halves 500+500, total conserved 1000→1000; probe scale ×1.2084;
PISTOL/SNIPER realized 84.588 per 10 submitted; STORMBREAKER confirmed-hit 446 realized
**538.946**; a 500-HP half **dies to one STORMBREAKER hit** (local pool law, total final 501).
No HP/damage numbers were touched.

## Browser-suite result

**Not re-runnable in this sandbox (environment limitation, reported honestly).**
The existing suite (`tools/testArsenalQuestRuntime.mjs`) requires a Chrome binary via
`CHROME_PATH`. This sandbox has no Chrome/Chromium, and both browser CDNs
(`cdn.playwright.dev`, `storage.googleapis.com/chrome-for-testing-public`) are unreachable
(connection failure; npm registry works). Per doc 15 §7, the download path was stopped after
one bounded economical attempt — no new harness, no bespoke CDP framework, no hours spent.
**Durable standing evidence (unchanged lineage):** C4 verified **217/217 vs dev server** and
**217/217 vs the production build** (`vite preview`) on `af649ab`; tip `84d3863` differs from
that by generated evidence files only. The production build produced in this session is the
owner-playable artifact; owner playtest is the visual/feel acceptance gate.

## Screenshot evidence

- **New screenshots this session:** none (no Chrome available; see above).
- **Standing evidence:** committed rendered goldens (incl.
  `golden-slime-bodies-sniper-targeting.png`), smoke frames, and the G1–G7 mechanical gate
  records in `docs/hero-rework/evidence/slime-owner-fix-gates-report.json`.
- **Intentionally NOT reconstructed** (per doc 15 §3/§7 and mission orders):
  `docs/hero-rework/preview/preview-harness.html`,
  `docs/hero-rework/preview/preview-scenarios.js`,
  `tools/captureSlimeOwnerFixBrowserEvidence.mjs`,
  `docs/hero-rework/evidence/slime-owner-fix-browser-report.json`, or any replacement
  Chromium/CDP capture framework. Verified absent. Screenshots are evidence, not acceptance.

## Product truths preserved (spot-confirmed via gates + code)

Extra-body held weapon rendered; no duplicate anchor draw; extra living bodies valid Storm
floor targets; floor damage 0 / stun 1.0s / no-stun-shortening; thrown Stormbreaker body-aware;
top HUD = Combatant total; local HP indicators multi-body-only; A2/passive child inherits source
heading; no target/pickup/corner steering; two A2 children legal when thresholds require;
SLIME children stay out of `fighters[]`; no A1/A2/passive number changes; no damage multiplier;
no ROBOT gameplay changes; no BLACK_HOLE visual changes; blood/splatter intact.

## Commits (this session, in order)

1. `(this commit)` — `docs(hero-rework): SLIME crash-recovery closeout verification`
   — this report only; no product, test, or evidence-file changes.

**Final pushed SHA:** tip of `arena/01a0e90e-apex-chaos` at push
(resolve with `git rev-parse origin/arena/01a0e90e-apex-chaos`).
**Exact owner-playtest SHA:** the same pushed tip — the tree is gameplay-identical to the
verified durable tip `84d386337d97ed4575a0cf476ecf05ec54321660` plus this report.

Owner playtest (from the playtest SHA):

```bash
npm install --no-package-lock
node tools/materializeArsenalFinalSfx.mjs
node tools/generatePublicAssetManifest.cjs && npx vite build
npx vite preview --port 4173   # play the production build
```

## Remaining unresolved SLIME design / balance questions (owner authority)

1. Half-pool survivability vs confirmed-heavy hits (500-HP half vs 538.946-realized STORMBREAKER).
2. Whether temporary body-local HP indicators become permanent HUD design (visual-design question).
3. A1 `divergenceTarget` "±25" semantic/unit (provisional degree reading stays behind cfg).
4. ROBOT Passive milestone thresholds (carried over; ROBOT mechanics owner-passed, not reopened).
5. Arsenal browser/headless warmup-input timing flakes (`both-unarmed-*`,
   `owner-cp6-input-alive-during-warmup`, `force-reveal-at-3.0-not-autopickup`) — outside SLIME.

SLIME OWNER-CORRECTION ENGINEERING CANDIDATE READY — NOT OWNER ACCEPTED
