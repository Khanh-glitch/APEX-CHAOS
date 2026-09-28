# SLIME crash-recovery closeout

## Durable Git recovery

- Actual session branch: `arena/01a0e912-apex-chaos`.
- Initial checkout: `ac280791b51eb6093d24bbdf398dc97938f61455`; clean before recovery.
- Recovered starting remote SHA: `84d386337d97ed4575a0cf476ecf05ec54321660` on `arena/01a0e749-apex-chaos`. Remote had advanced beyond the authority's `af649ab63a9b933c40280bd9f6a9f4a670616a70` snapshot: `29ffec9` added the prior C4 report, then `84d3863` refreshed evidence. Neither is reconstructed lost workspace work.
- Read recovery authority `696170b004e90585ea65a93a493037ab9533ba32` completely, and doc 14. The authority file is copied unchanged into this branch for durable context. Authority/safety refs were not modified.
- Verified C1 `67d55896f73f5a6d094fe3ba06b4f4b4b04bfed7`, C2 `35a6862e2060faa5ed449fba1d02163665c61c0e`, and C3 `4a13807ac94d665088ada07a82afa5f020bb9bb7` as ancestors; inspected their production changes and reran their gates.

New commits in order:
1. `0d741b6429462b966e525461dd211bb88cb395ff`: merge current durable correction lineage into the assigned session branch, preserving the starting main-branch ZIP asset. Pushed successfully.
2. The documentation/evidence commit containing this report (`docs(hero-rework): close out recovered SLIME candidate`). This is the final pushed closeout commit; its exact SHA is resolved with `git log -1 --format=%H -- docs/hero-rework/phase1/16_SLIME_CRASH_RECOVERY_CLOSEOUT_2026-09-28.md` and supplied in the session closeout. A commit cannot embed its own resulting hash.

**Exact owner-playtest / final pushed production SHA: `0d741b6429462b966e525461dd211bb88cb395ff`.** The subsequent closeout commit changes only documentation/evidence, not production code. No fixes were reimplemented and no product changes were needed.

## Fresh verification

Read package scripts and existing test definitions before execution. Installed declared dependencies using `npm install --no-package-lock`. Ran the existing materializer, then each existing Node test unchanged. Reports are preserved in `docs/hero-rework/evidence/crash-closeout/`.

| Existing tool | Result |
| --- | --- |
| `testHeroReworkSlimeOwnerFixGates.mjs` | 7/7 |
| `testHeroReworkSlimeGates.mjs` | 9/9 |
| `testHeroReworkSlimeKitGates.mjs` | 5/5 |
| `testHeroReworkSlimeLegacySeparation.mjs` | 6/6 |
| `testHeroReworkRobotGates.mjs` | 9/9 |
| `smokeHeroReworkHeadless.mjs` | 17/17 |
| `testHeroReworkGoldens.mjs` | 11/11 |
| `testArsenalQuestHeadless.mjs` | 334/334 |
| `testArsenalQuestRuntime.mjs` | Environment-blocked before any browser assertions: Chrome spawn ENOENT |
| Production build | PASS: materialize SFX, generate manifest (690 assets), Vite build (35 modules) |

Build executed the package build pipeline's exact constituent commands directly because pnpm was unavailable. The only generated tracked build difference was manifest timestamp; restored it rather than committing meaningless churn. No assertions or fixtures changed. Dependency installation reported one moderate and one high audit finding; dependency upgrades are outside this closeout.

### Targeted behavior and preservation

G1/G2 exercise real split-body physical pickup, exact-holder foreground draw, no duplicate anchor draw, and normal weapon use lifecycle. This is renderer-call/mechanical proof, not new browser visual acceptance.

G3 verifies extra living bodies receive Storm floor stun, zero floor damage, nominal 1.0s stun, no shortening of longer stun, exclusion of retired/dead bodies, and direct thrown Storm body collision. G4 verifies local indicator lifecycle and Combatant-total HUD. G5 verifies source normalized heading inheritance for A2/passive and legitimate two-child A2 threshold arithmetic. Children remain outside global `fighters[]`.

G6: **the second corner-stuck bug did not reproduce**. Across 35 scenarios / five seeds, `anyViolation=false`; wall/corner return is exercised. No speculative corner nudge or steering added. Normal inertia and collision/bounce remain authoritative.

G7 survivability, real production damage path, diagnostic only:
- Before A1: local/total HP 1000. After: 500 + 500, total 1000.
- Existing shared roster probe scale: 1.2084.
- Pistol and sniper: each 84.588 realized per 10 submitted in these probes (not a claim about every full weapon attack).
- Stormbreaker: 538.946 realized per 446 submitted; this exceeds a half's 500 local pool, so that body dies. Recorded final Combatant total is 501 under the full lifecycle exercised by the gate.
- No new incoming multiplier, HP/damage rebalance, or A1/A2/passive number changes.

No concrete new product regression found. ROBOT gameplay, BLACK_HOLE visuals, other Hero implementations, and blood/splatter are unchanged from recovered production truth.

## Browser / screenshot evidence limits

The existing real-browser suite was invoked unchanged and failed to launch its default Windows Chrome executable (`ENOENT`). Searches found no installed Chrome/Chromium executable in this sandbox. Classification: **environment limitation**, not a product regression or passing browser run. No browser assertions or fresh browser screenshots completed here. The prior durable C4 report records 217/217 production-browser gates after one warmup/input timing retry; that is historical evidence, not a fresh result from this session.

Existing committed screenshots remain under `docs/arsenal-quest/browser-evidence/`; existing Hero Rework canvas goldens remain under `docs/hero-rework/evidence/`, including `golden-slime-bodies-sniper-targeting.png`. Fresh headless renders were generated in ignored `reports/slime-closeout/evidence/`; they are canvas evidence, not Chromium captures. Fresh JSON verification reports and the browser launch/build logs are committed with this report.

Intentionally did NOT reconstruct `preview-harness.html`, `preview-scenarios.js`, `captureSlimeOwnerFixBrowserEvidence.mjs`, or any replacement CDP/capture framework. Did not download new browser infrastructure. Missing owner-specific screenshots do not supersede the playable production candidate or imply owner acceptance.

## Owner playtest and unresolved questions

Play production SHA `0d741b6429462b966e525461dd211bb88cb395ff`. Build using the repository's `pnpm build` after dependency installation, then serve `dist/` using Vite preview. The session also exposes the built production preview.

Owner decisions still needed: half-pool survivability against heavy confirmed hits; permanent design of temporary body-local indicators; unresolved A1 ±25 divergence semantic/unit. No tuning attempted. Owner should specifically inspect held child weapons, floor stun, local-versus-total HP, and wall/corner movement. Fresh browser regression remains unverified in this environment; run the existing suite on a machine with Chrome. Screenshots and automated gates are not owner acceptance.

SLIME OWNER-CORRECTION ENGINEERING CANDIDATE READY — NOT OWNER ACCEPTED