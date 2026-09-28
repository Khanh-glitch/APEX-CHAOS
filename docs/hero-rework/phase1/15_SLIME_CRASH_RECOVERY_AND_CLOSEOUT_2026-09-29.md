# APEX CHAOS — SLIME CRASH RECOVERY AND CLOSEOUT
Date: 2026-09-29

## Authority status

This document is the recovery/closeout authority for the interrupted SLIME owner-correction pass.

It does **not** replace the gameplay laws in:

`docs/hero-rework/phase1/14_SLIME_OWNER_CORRECTION_PASS_2026-09-28.md`

It **does** supersede doc 14 wherever doc 14 would cause a new Agent to rebuild lost screenshot/capture infrastructure or redo already-durable C1–C3 engineering work.

The previous Arena session crashed after roughly two hours. Its ephemeral local workspace is not trusted. Remote Git is the durable source of truth.

SLIME remains **NOT OWNER ACCEPTED** until the owner plays the resulting build.

---

# 1. Recover from Git first

Repository:

`Khanh-glitch/APEX-CHAOS`

Interrupted session branch:

`arena/01a0e749-apex-chaos`

Live remote state audited immediately before this authority was created:

- remote tip: `af649ab63a9b933c40280bd9f6a9f4a670616a70`
- tip message: `chore(arsenal): refresh real-browser evidence [skip ci]`
- its parent: `7052102607d87df69b6b361ecf78c18182b80c4d`

Safety snapshot:

`safety/pre-slime-crash-recovery-20260929`

Recovery authority branch:

`director/slime-crash-recovery-20260929`

At the start of a new Arena session:

1. inspect `git status --short`
2. inspect `git diff`
3. inspect current branch / HEAD
4. fetch the remote
5. inspect `arena/01a0e749-apex-chaos`
6. preserve any real local work before resetting, cleaning, or switching
7. recover from the current durable remote lineage, not from an old qualification SHA

Do **not** reset back to `2a5c666...`, `0436aab...`, or any older pre-correction baseline.

Do **not** assume an Arena workspace survived the crash.

---

# 2. Durable work that already exists — DO NOT REDO IT

The important owner-correction engineering survived on remote Git.

## C1 — body-aware held-weapon rendering

Durable commit:

`67d55896f73f5a6d094fe3ba06b4f4b4b04bfed7`

The production code now includes a generic Hero Rework extra-body enumeration path and Arsenal equipped-weapon rendering covers:

- normal `fighters[]`
- living extra Hero Rework bodies
- no duplicate anchor draw

Relevant production surfaces include:

- `public/game/hero-rework/heroReworkRuntime.js`
- `public/game/modes/arsenalQuestRuntime.js`

Do not redesign this unless verification proves a concrete regression.

## C2 — Stormbreaker floor-lightning body enumeration

Durable commit:

`35a6862e2060faa5ed449fba1d02163665c61c0e`

Floor-lightning target enumeration now uses the Hero Rework body-aware environment target path rather than only `fighters[]`.

Frozen behavior remains:

- extra living SLIME bodies are valid floor-lightning targets
- damage = 0
- stun = 1.0s
- a shorter floor stun must not shorten a longer existing stun
- visible floor-bolt geometry remains contact authority
- dead / retired bodies are excluded
- direct thrown Stormbreaker body-aware collision must not regress

Do not turn accidental immunity into a feature.

## C3 — local HP readability + child heading + corner diagnostics

Durable commit:

`4a13807ac94d665088ada07a82afa5f020bb9bb7`

This lineage contains the owner-fix gate work for:

- temporary body-local SLIME HP readability while multiple bodies are alive
- A2/passive child heading inheritance from the source body
- corner / wall / movement diagnostics
- SLIME owner-fix gate coverage
- regression adjustments needed to run the real production lifecycle

A later durable merge preserved this work:

`7052102607d87df69b6b361ecf78c18182b80c4d`

The current remote evidence-bot tip `af649ab...` is one commit after that merge.

Again: verify these behaviors; do not rebuild them from scratch.

---

# 3. What the crash actually lost

The previous Agent had begun working on the final closeout / browser-proof stage.

The following attempted recovery/capture infrastructure is **not present on the durable remote** and must not be recreated merely because it existed in the crashed workspace:

- `docs/hero-rework/preview/preview-harness.html`
- `docs/hero-rework/preview/preview-scenarios.js`
- `tools/captureSlimeOwnerFixBrowserEvidence.mjs`
- `docs/hero-rework/evidence/slime-owner-fix-browser-report.json`
- an unfinished final owner-correction report

This missing work is intentionally **not** a reconstruction requirement.

The prior session spent too much time turning screenshot capture into a second engineering project.

Do not repeat that mistake.

---

# 4. Current mission

This is a **closeout mission**, not another implementation pass.

The goal is to turn the durable C1–C3 fixes into a stable, testable owner-playable candidate with truthful regression evidence.

Priority order:

1. recover and verify the durable code
2. run the existing targeted SLIME owner-fix gates
3. run the existing SLIME / ROBOT / Hero Rework regressions
4. run the existing Arsenal headless/browser suites that already belong to the project
5. run the production build
6. fix only concrete regressions uncovered by those real tests
7. push any necessary minimal fixes
8. create a concise final closeout report
9. provide the exact commit the owner should playtest
10. stop

**Owner-playable production truth outranks perfect screenshot automation.**

---

# 5. Explicitly forbidden

Do not:

- redo C1, C2, or C3 from scratch
- rebuild a custom preview harness
- build a new Chromium/CDP screenshot framework
- spend hours installing/downloading browser infrastructure just to satisfy screenshots
- create fake/synthetic screenshots and call them owner proof
- redesign SLIME
- rebalance SLIME HP or damage
- change A1/A2/passive frozen numbers
- invent an incoming SLIME damage multiplier
- change Stormbreaker gameplay values
- touch ROBOT gameplay
- touch BLACK_HOLE visuals
- work on any other Hero
- alter blood/splatter
- add target/pickup steering to SLIME bodies
- push SLIME children into the global `fighters[]` array
- weaken existing assertions simply to get green tests
- destructively rewrite remote history

No speculative “corner nudge” or AI steering is allowed. Normal APEX heading/inertia + collision/bounce remains the movement law.

---

# 6. Verification expectations

Use existing project tooling first.

At minimum re-prove the behaviors that motivated the owner correction:

### Weapon presentation
- a living extra SLIME body can hold a real weapon
- the real equipped-weapon render path includes that exact body
- anchor is not drawn twice
- use/throw/detach lifecycle still works

### Storm floor lightning
- living extra SLIME body is targetable
- floor contact does zero damage
- standard floor stun remains 1s
- longer existing stun is not shortened
- dead / retired bodies are excluded
- direct thrown Stormbreaker can still collide with a living extra body

### HP readability
- multi-body SLIME exposes local HP indicators
- top HUD remains Combatant total HP
- local damage changes only the struck body's local indicator
- dead / merged / expired body indicator disappears correctly

### Child movement
- A2/passive child inherits source body's normalized heading
- a legitimate large A2 hit may spawn two children if threshold arithmetic requires it
- no forced constructor-default leftward heading
- wall and corner collision returns a live, unlocked child to normal movement
- if no second corner-stuck bug reproduces, say so; do not invent a fix

### Survivability
Use the real production damage path and report what current code actually does. This remains diagnostic only. No tuning in this mission.

---

# 7. Browser evidence policy for this recovery

Real browser behavior still matters.

However, the new Agent must use **existing production/browser tooling only**.

If the existing suite can cheaply capture a useful owner-readable frame, keep it.

If browser screenshots require building a new harness, downloading new browser infrastructure, or writing a bespoke capture system:

**do not do that.**

Instead:

- run the existing real-browser regression path available in the repository
- report exactly what was and was not visually captured
- provide the playable build/commit to the owner
- let owner playtest be the actual visual/feel acceptance gate

Screenshots are evidence.

They are not owner acceptance.

Missing bespoke screenshot automation is not a reason to block a playable closeout.

---

# 8. Regression scope

Use the existing repository commands/scripts after reading their actual definitions.

Expected categories:

- SLIME owner-fix gates
- existing SLIME physics gates
- existing SLIME kit gates
- ROBOT gates
- Hero Rework smoke
- Hero Rework goldens
- Arsenal headless suite
- existing real-browser suite
- production build

Do not invent new giant test infrastructure if the existing suites already exercise the relevant production paths.

If a test fails:

1. determine whether it is a real product regression, stale expectation, fixture problem, environment limitation, or known flaky condition
2. do not change product code until root cause is understood
3. fix only the smallest justified surface
4. rerun the targeted gate
5. then rerun the affected regression scope

---

# 9. Git / checkpoint law

Remote Git is durable. Arena workspace is not.

If verification finds no new product bug, do not manufacture a gameplay commit just to have one.

If a concrete new fix is required:

`targeted proof -> commit -> fetch/reconcile -> push`

Do not accumulate multiple solved bugs only in local state.

The final closeout/report must also be pushed before the session ends.

Do not modify:

- `safety/pre-slime-crash-recovery-20260929`
- `director/slime-crash-recovery-20260929`

Those are recovery authority/safety refs.

Work on the Arena session branch assigned to the new chat, based on the current durable SLIME correction lineage.

---

# 10. Final report

Create a concise durable report under:

`docs/hero-rework/phase1/`

Include:

- actual session branch
- starting durable SHA
- final pushed SHA
- any new commits in order
- verification results
- any real regression found and exact fix
- whether the corner-stuck second bug reproduced
- survivability observations without tuning
- browser-suite result
- production build result
- what screenshot evidence exists, if any
- what screenshot automation was intentionally not rebuilt
- exact owner-playtest commit
- remaining unresolved SLIME design/balance questions

Do not claim owner acceptance.

End the report exactly with:

`SLIME OWNER-CORRECTION ENGINEERING CANDIDATE READY — NOT OWNER ACCEPTED`

---

# 11. Stop condition

Once:

- durable fixes are verified,
- required existing regressions/build have been run,
- any concrete regression is minimally repaired and pushed,
- final report is pushed,
- exact owner-playtest SHA is identified,

**STOP.**

Do not expand into another Hero, final VFX, balance work, screenshot tooling, or general refactor.

The next meaningful gate is the owner's real playtest.
