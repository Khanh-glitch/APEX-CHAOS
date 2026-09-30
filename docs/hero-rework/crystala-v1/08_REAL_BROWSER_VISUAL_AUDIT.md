# CRYSTALA V1 — REAL-BROWSER VISUAL AUDIT

Date: 2026-09-30
Status: OWNER QA AUTHORITY
Source branch: `arena/01a0ee80-apex-chaos`
Required starting ancestor: `7cb49e61977a05c6f9e9b862e4aa3141cdaf78e4`
Current runtime revision: `20260930-crystala-presentationfix-r1`

## 0. Mission
This is a ONE-SHOT, unattended, REAL-GAME browser audit of CRYSTALA after the presentation correction pass.

The purpose is NOT to rebuild CRYSTALA and NOT to redesign its art.

The purpose is to prove that the production game — not an isolated canvas harness — presents CRYSTALA correctly under real Apex draw order, Chamber, camera motion, Arsenal projectiles, status effects and J/K gameplay.

Do not ask the owner mid-run questions. Do not stop after setup. Give one final report after all independently completable browser scenarios are exhausted.

## 1. Starting state
The durable implementation line is:

- Checkpoint A gameplay: `e26da2bfcddfd81a789b5da7d85957a19fc20d40`
- Checkpoint B presentation: `9356f55ac3228b8768991d91efbaad4c77459e63`
- Checkpoint C evidence/integration: `e80e6684948209b19f80aa051649b30c9e2696b6`
- Presentation correction: `7cb49e61977a05c6f9e9b862e4aa3141cdaf78e4`

The correction already fixed and regression-tested:
1. Wall/dust/debris double-render.
2. Bloom not following camera transform.
3. Missing generic Crystal status VFX.
4. Presentation-only fallback six-shard rig.

Do NOT reopen these as speculative code work. Verify them in the real game.

Known unrelated CI condition:
- headless on the correction SHA reached 334/335;
- only `av-assets-preloaded` remained failing;
- do not change CRYSTALA or protected systems to cure that unrelated baseline gate.

## 2. Source/branch handling
A fresh Arena session may be pinned to another clean `arena/*` branch.

Keep the Arena-pinned session branch.
Fetch:
`origin/arena/01a0ee80-apex-chaos`

If the session tree is clean and does not already contain `7cb49e61977a05c6f9e9b862e4aa3141cdaf78e4`, anchor the CURRENT session branch forward to `origin/arena/01a0ee80-apex-chaos`.

Never mutate/force-push the source branch unless the session is actually pinned to it.
Never reset backward.
Never rebuild A/B/C.

Before browser work verify:
- `7cb49e61977a05c6f9e9b862e4aa3141cdaf78e4` is in HEAD ancestry;
- runtime revision is `20260930-crystala-presentationfix-r1`;
- `crystalaPresentationRuntime.js` exists;
- gameplay/parity files exist.

## 3. Browser requirement
Use the actual production game/runtime in a real browser.

The following do NOT count as visual proof:
- `@napi-rs/canvas` isolated rendering;
- calling `APEX_CRYSTALA_GOLD` directly on a fake floor;
- static Gold HTML alone;
- screenshots from a synthetic canvas harness.

The evidence frame must come from the actual Apex game canvas after the real runtime loader, Quest mode, Fighter.draw chain, Chamber palette runtime and Arsenal runtime are active.

Use the project-supported browser/dev-server workflow. Do not alter production code merely to make screenshots easier.

## 4. Evidence directory
Write real-browser evidence under:

`docs/hero-rework/crystala-v1/evidence-browser/`

Minimum artifacts:
- `01-dormant-real-game.png`
- `02-awake-k-real-game.png`
- `03-real-projectile-intercept.png`
- `04-refraction-return.png`
- `05-wall-real-game.png`
- `06-prison-real-game.png`
- `07-camera-shake-bloom.png`
- `08-status-vfx.png`
- `09-chamber-readability.png`
- `REAL_BROWSER_AUDIT.md`

Screenshots must capture the game canvas at a useful scale and show enough surrounding arena context to judge layer placement.

Do not manufacture screenshots from Gold renderer-only tools.

## 5. Scenario RB01 — dormant production silhouette
Start an actual Crystal match.

Before K:
- Crystal body must use CRYSTALA Gold identity, not old/generic Crystal art.
- exactly six physical shards are visually present/orbiting when all are available;
- dormant body/shards read dark/inactive;
- no passive auto-reflection;
- equipped Arsenal weapon is drawn only once;
- no duplicate generic fighter body underneath/over the Crystal body.

Capture `01-dormant-real-game.png`.

## 6. Scenario RB02 — K awakening
Activate K in the real match.

Verify visually:
- eyes/jewel/shards awaken;
- six shards remain individual objects, not a bubble shield;
- orbit still has lag/depth/redistribution language;
- no standalone full-circle shield visual;
- K expiry returns dormant state while already committed shard jobs may finish.

Capture `02-awake-k-real-game.png`.

## 7. Scenario RB03 — real Arsenal projectile interception
Use an actual reflectable Arsenal firearm projectile in the real game, not a synthetic `SLOW` test projectile.

Prefer one clear single-projectile weapon first, then at least one burst/automatic weapon if practical.

Verify:
- only a projectile predicted to hit Crystal is assigned;
- a real shard leaves orbit;
- no teleport;
- contact cancels incoming Crystal hit;
- real facet/refraction/internal-light beat is visible;
- outgoing reflected projectile uses the game projectile path;
- no second visual projectile is invented.

Capture `03-real-projectile-intercept.png`.

Record the actual weapon name(s) used in `REAL_BROWSER_AUDIT.md`.

## 8. Scenario RB04 — recoil/banking return
Continue from a successful real intercept.

Verify:
- shard recoils/spins;
- returns on a curved/Hermite-like banking path;
- no straight snap/teleport;
- availability visually returns on docking;
- if it docks while K remains active it can visibly participate again.

Capture `04-refraction-return.png`.

## 9. Scenario RB05 — Wall in real production draw order
Create a real J Wall while K is active with 2–5 available shards.

Verify:
- exactly two shards commit;
- dense ~220 px Wall language appears;
- two-front growth/seam/ZIP-LOCK remain readable;
- Wall appears ONCE, not double-bright/double-thick;
- Wall is behind the fighter as intended;
- debris/dust do not appear duplicated;
- equipped weapon remains single-dispatch;
- visible material and collision timing agree.

If practical, let a real projectile hit/damage/break it and inspect cracks/chips.

Capture `05-wall-real-game.png`.

## 10. Scenario RB06 — Prison depth split
Create real Prison with six available shards.

Verify:
- six-side material cage;
- back edges render behind fighters;
- front edges render in front;
- cage is not a flat overlay on top of everything;
- target can visibly move inside before physical edge contact;
- no invisible root;
- final-gap closure reads clearly.

If practical, damage a facet and verify the visible gap corresponds to the physical escape gap.

Capture `06-prison-real-game.png`.

## 11. Scenario RB07 — camera shake / zoom / bloom correction
Trigger a real combat situation with visible camera shake and/or zoom while Crystal is awake and preferably while shards/constructs are emissive.

Verify frame-by-frame or via closely spaced captures:
- bloom remains spatially attached to body, shards and constructs;
- no ghost glow at pre-shake coordinates;
- no scale mismatch between crisp geometry and bloom;
- half-resolution bloom remains soft but does not blur the dark body itself.

Capture `07-camera-shake-bloom.png`.

If the game has no deterministic manual trigger, use an existing real gameplay source of shake/zoom. Do not add a production-only debug effect.

## 12. Scenario RB08 — generic status VFX on Crystal
Apply real status effects through existing game mechanics or safe browser-side invocation of existing runtime APIs.

At minimum verify:
- STUN or FREEZE;
- WEAK or POISON if practical.

The status cue must remain outside the Chamber actor source while the CRYSTALA body stays intact.

Verify no generic fighter body is reintroduced.

Capture `08-status-vfx.png`.

## 13. Scenario RB09 — Chamber integration/readability
Run Crystal with the Chamber palette active through the real product path.

Verify:
- actor source is processed once by Chamber;
- body identity remains CRYSTALA;
- shards/world FX are not swallowed into the actor silhouette;
- front/back Prison depth remains correct;
- equipped weapon is still one copy;
- no whole-scene palette/filter rewrite attributable to Crystal.

Capture `09-chamber-readability.png`.

## 14. Actual-browser assertions
Where practical, add a narrow browser QA script/gate that checks production facts not covered by renderer-only parity:

- runtime revision loaded;
- Crystal presentation runtime ready;
- live match contains CRYSTAL combatant;
- presentation inspect points to gameplay-owned rig;
- no presentation fallback rig creation;
- K changes live rig awake state;
- real Wall draw count is not doubled per frame;
- real Prison uses back/front passes;
- camera matrix reaches bloom begin;
- at least one generic status cue draws for Crystal.

Do NOT weaken existing tests to make this pass.

If a browser gate requires a temporary instrumentation hook, keep it QA-only and do not alter gameplay semantics.

## 15. Bug policy
If ALL scenarios look correct:
- do not edit production code;
- commit only evidence/audit tooling if useful;
- push and remote-verify.

If an actual production bug is reproduced:
1. document the exact reproduction first;
2. make the smallest Crystal presentation/shared-render fix possible;
3. do NOT alter Checkpoint-A gameplay semantics unless the bug demonstrably originates there;
4. do NOT edit Robot/Hunter/Chamber semantics;
5. add a regression gate for the exact bug;
6. commit + push the fix BEFORE continuing other evidence;
7. rerun the exact reproduction in the real browser;
8. then continue the remaining scenarios.

Never accumulate another large local-only visual pass.

## 16. Gold comparison standard
Compare the real-game result against:
- `01_OWNER_APPROVED_GOLD_REFERENCE.html`
- `00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md`
- `02_GOLD_TO_GAME_ADAPTATION_MAP.md`

Judge concrete authored properties:
- silhouette;
- six shard identities;
- orbit lag/depth;
- dormant/awake contrast;
- refraction beat;
- recoil/return path;
- Wall cell/growth/seam language;
- Prison depth/closure language;
- dust/debris restraint;
- bloom attachment/readability.

Do not redesign based on personal taste during this audit.

## 17. Balance/evidence caution
Do NOT treat the current 45-second seeded match telemetry as balance proof.

Previous C evidence runs with the same nominal seed produced materially different threat/intercept outcomes because not every Arsenal random source is controlled by the Hero Rework seed.

This task is visual/integration QA, not balance tuning.

Do not retune Crystal cooldowns, damage, AI or Arsenal based on one browser match.

## 18. Completion
The task is complete when:
- all practical RB01–RB09 real-browser scenarios have been inspected;
- actual screenshots are saved;
- `REAL_BROWSER_AUDIT.md` records PASS/FAIL and concrete observations;
- any reproduced bug has a minimal fix + regression gate + successful retest;
- every new commit is on remote and remote-verified.

Final report once only:
- session branch;
- starting SHA;
- any fix SHA(s);
- evidence SHA/final SHA;
- exact browser scenarios completed;
- actual weapons/statuses used;
- PASS/FAIL per RB01–RB09;
- any deviation from Gold with screenshot filename;
- any remaining browser/tooling blocker;
- confirmation Checkpoint-A gameplay, Robot, Hunter, Chamber semantics and 12k grant were not changed.
