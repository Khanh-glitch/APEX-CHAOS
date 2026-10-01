# CRYSTALA V1 — POST-CHECKPOINT-A B/C REBUILD HANDOFF

Date: 2026-09-30
Status: ONE-SHOT RECOVERY AUTHORITY
Remote implementation branch: `arena/01a0ee80-apex-chaos`
Durable starting point: `e26da2bfcddfd81a789b5da7d85957a19fc20d40`

## 0. Why this file exists
A completed local Checkpoint B/C implementation was lost after Arena rebuilt the sandbox while GitHub authentication was failing. Those local commits no longer exist locally or remotely.

Do NOT investigate recovery again.

Do NOT rebuild Checkpoint A.

Checkpoint A is durable on remote and is the only implementation base for the continuation.

Lost local-only historical SHAs (NON-RECOVERABLE, reference only):
- Checkpoint B: `71f4fbcb5fc64bf24dc68027c71e517727a49506`
- Checkpoint C/final: `2ae2855b4b1a4bb6d0c4bbd6990390f7710ea1e4`

They are not valid GitHub objects. Never attempt to fetch/cherry-pick them.

## 1. Durable Checkpoint A truth
Remote Checkpoint A:
`e26da2bfcddfd81a789b5da7d85957a19fc20d40`

Already durable and must be preserved:
- `public/game/hero-rework/crystalGameplayRuntime.js`
- `public/game/hero-rework/crystalaGoldV6.js` (Checkpoint-A motion/core port)
- Crystal registry/executor/shared geometry wiring
- `tools/lib/crystalaHarness.mjs`
- `tools/testCrystalaGameplayGates.mjs`
- `tools/testCrystalaGoldParity.mjs` (Checkpoint-A parity subset)
- runtime revision/lock changes through Checkpoint A
- related Hero Rework golden/headless compatibility changes

Checkpoint A reported and remote commit records:
- 64/64 Crystal gameplay gates green
- 11/11 initial Gold parity gates green
- gameplay truth, smart predictor, constructs and anti-tunnelling complete

Unless a B/C integration test proves an actual Checkpoint-A bug, DO NOT rewrite/re-architect A.

## 2. What was lost after A
The final report from the destroyed sandbox recorded these files/deltas beyond A:

Missing on remote and must be rebuilt:
- `public/game/hero-rework/crystalaPresentationRuntime.js` (~158 LOC in lost final)
- `tools/captureCrystalaVisualParity.mjs` (~197 LOC)
- `tools/generateCrystalaEvidence.mjs` (~385 LOC)
- `docs/hero-rework/crystala-v1/evidence/crystal-robot-matchup-report.json`
- 9 visual parity PNGs under `docs/hero-rework/crystala-v1/evidence/`

Existing files that had additional B/C work in the lost final:
- `public/game/hero-rework/crystalaGoldV6.js`
  - durable A: ~1292 lines
  - lost final report: ~1896 lines
  - therefore presentation/construct/refraction/dust/bloom work remained after A
- `tools/testCrystalaGoldParity.mjs`
  - durable A: ~158 lines
  - lost final report: ~248 lines
  - final target included P01–P21
- `src/game/runtimeManifest.js`
- `tools/runtimeRevision.lock.json`
- `tools/testChamberPaletteGates.mjs`

The lost final report also mentioned small final-integration changes in:
- `tools/smokeHeroReworkHeadless.mjs`
- `tools/testArsenalQuestHeadless.mjs`
- `tools/testHeroReworkGoldens.mjs`
- `tools/testHeroReworkHunterOwnerFixGates.mjs`

Treat those as evidence of what final validation needed, NOT permission to weaken gates.

## 3. Rebuild target — Checkpoint B
Rebuild the missing Gold/presentation integration from the existing executable Gold authority and current A core.

Required production result:
- complete faithful CRYSTALA procedural appearance
- dormant/awake actor state
- six unique shard identities
- spring elliptical orbit and redistribution
- real intercept/refraction/recoil/banking return presentation
- Wall two-front 13-cell growth, seam and ZIP-LOCK
- impact cracks/chips/debris
- Prison six-side encircle/chain growth/final-gap closure
- restrained Ancient Dust
- authored bloom with cached buffers
- Chamber actorRender integration
- no double weapon render
- no presentation ownership of gameplay truth

Preferred missing adapter:
`public/game/hero-rework/crystalaPresentationRuntime.js`

Final lost report said the intended architecture was:
- actor source renders once through Chamber `actorRender`
- orbiting shards/trails/construct/refraction/dust stay in world context outside actor silhouette
- Arsenal remains sole equipped-weapon renderer
- cached half-resolution bloom, no per-frame DOM/canvas allocation

Retiming target remains ~0.75 s to visible construct solidity while preserving Gold phase grammar.

Gold parity target:
`tools/testCrystalaGoldParity.mjs` -> 21/21 PASS (P01–P21)

Checkpoint B is not complete until focused browser/visual parity and Chamber integrity are proven.

## 4. Rebuild target — Checkpoint C
Rebuild final evidence/integration tooling and validation.

Expected tools:
- `tools/captureCrystalaVisualParity.mjs`
- `tools/generateCrystalaEvidence.mjs`

Expected visual evidence set:
1. `crystala-01-dormant-silhouette.png`
2. `crystala-02-awake-luminous.png`
3. `crystala-03-intercept-refraction.png`
4. `crystala-04-recoil-banking-return.png`
5. `crystala-05-wall-growth-seam-lock.png`
6. `crystala-06-wall-impact-cracks.png`
7. `crystala-07-prison-burst-encircle.png`
8. `crystala-08-prison-chain-closure.png`
9. `crystala-09-bloom-readability.png`

Expected matchup artifact:
`docs/hero-rework/crystala-v1/evidence/crystal-robot-matchup-report.json`

Lost-final validation targets (reproduce behavior, do not blindly hardcode outputs):
- Crystal gameplay gates: 64/64 PASS
- Gold parity: 21/21 PASS
- Crystal-vs-Robot evidence matrix: 15/15 PASS
- runtime revision gate PASS
- Hunter owner-fix gates 8/8 PASS
- Robot gates 11/11 PASS
- Robot recoil gates 6/6 PASS
- locomotion gates 4/4 PASS
- Slime suites remain green
- Hero Rework goldens 11/11 PASS
- Chamber palette gates 15/15 PASS
- `pnpm build` EXIT 0

Final runtime revision from the lost report was:
`20260930-crystala-b-r1`

Use the current repository revision discipline; do not set this string without updating the lock correctly.

## 5. Known unrelated broad-suite baseline issues
Do not derail the B/C rebuild on unrelated known baseline/harness issues.

Previously documented broad-suite conditions included Hunter Gold/headless loading issues.

The lost final report additionally recorded:
- `tools/smokeHeroReworkHeadless.mjs`: 16/17, one baseline failure `smoke-robot-dash-moves-to-pickup` because a hardcoded 0.20 s probe is shorter than Robot A1 0.26 s windup.
- `tools/testArsenalQuestHeadless.mjs`: 333/335, two baseline issues: `av-assets-preloaded` audio count and flaky `postc-robot-dash-to-revealed` race.

Verify whether current remote A reproduces these before attributing them to CRYSTALA. Do not rewrite protected production semantics merely to hide baseline test conditions.

## 6. One-shot + durability law
Owner may be absent.

Do not ask mid-run questions.
Do not stop after B.
Do not stop after one unrelated failing suite.
Do not return an intermediate report.

Remote Git is the durable memory.

Push after EACH meaningful B/C slice. Maximum local-only work:
- one coherent module OR
- ~300–500 meaningful LOC OR
- ~10–15 minutes.

Suggested cadence:
1. B1: missing Gold presentation systems -> push
2. B2: presentation adapter + manifest wiring -> push
3. B3: P12–P21 parity/browser integrity -> push
4. Checkpoint B -> push/remote verify
5. C1: evidence generator -> push
6. C2: visual capture + evidence -> push
7. C3: regressions/revision/final audit -> push
8. Checkpoint C/final -> push/remote verify

If Git authentication fails:
- DO NOT continue accumulating large local-only work.
- immediately preserve whatever can be preserved through the available GitHub connection/API path if possible;
- otherwise keep the local delta minimal and retry authentication;
- never allow an entire B/C milestone to remain local again.

## 7. Protected systems
Do not directly redesign Robot/Hunter/Chamber semantics.

Use the current Crystal-specific/presentation/shared integration surfaces established by Checkpoint A.

If one protected change appears necessary:
- exhaust Crystal-specific/minimal shared-hook options;
- leave protected behavior intact if still blocked;
- finish all other work;
- report the residual item only in the final report.

## 8. Completion definition
B/C rebuild is complete only when:
- Checkpoint A remains intact;
- Gold/presentation integration is faithful;
- parity/evidence tools and artifacts exist;
- required focused regressions/build are run;
- B and C are both durable on REMOTE;
- final remote SHA is verified.

The final owner report must contain:
- starting remote A SHA;
- all new B/C durability SHAs;
- Checkpoint B SHA;
- Checkpoint C/final SHA;
- final remote tip;
- exact changed files;
- test/evidence/build results;
- known baseline failures separated from new regressions;
- confirmation protected semantics and 12,000 AC grant remain intact.
