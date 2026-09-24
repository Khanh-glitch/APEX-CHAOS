# APEX CHAOS // OWNER PLAYTEST REVISION 2 — IMPLEMENTATION RUNBOOK

**Purpose:** execution map for `OWNER_PLAYTEST_REVISION_2_CONTRACT.md`  
**Branch:** `arena/01a0cf5e-apex-chaos`  
**Playtest branch:** frozen until audit acceptance  
**Main:** untouched

This file is intentionally short. The product specification and observable requirements live in:

`docs/arsenal-quest/OWNER_PLAYTEST_REVISION_2_CONTRACT.md`

Treat that contract as the source of truth. This runbook defines how to execute it without losing requirements or producing false-green tests.

## 1. Start state

Before editing:

1. fetch remote;
2. confirm current branch is `arena/01a0cf5e-apex-chaos`;
3. inspect commits newer than the contract if HEAD has advanced;
4. do not reset good newer evidence/CI commits;
5. confirm `playtest/arsenal` and `main` are not being modified.

Read the contract in full before implementation.

Then create/update:

`docs/arsenal-quest/OWNER_PLAYTEST_REVISION_2_EXECUTION_PLAN.md`

The plan is working memory, not an approval gate. Do not stop and ask the owner to approve it. Proceed immediately after writing it.

The plan must track:
- milestone status;
- files touched;
- decisions;
- validation commands;
- evidence paths;
- genuine blockers.

## 2. Milestone A — weapon presentation + audio

Scope:
- one global Senko source-relative scale system;
- same scale language on floor/equipped/detached gun;
- world-space detached gun exits;
- rarity under-light replaces the black pickup shadow;
- gunshot fade-tail envelopes;
- casing/hull sound on floor contact.

Before implementation, add focused regression instrumentation/tests that fail against the current behavior where practical.

Important failure traps:
- do not replace per-gun `longSide` with a different hidden per-gun scale table;
- detached gun must stop following fighter world position after consume;
- one tiered pickup gets one under-light, not glow + black oval;
- casing sound must be tied to collision/landing event, not casing creation;
- audio fade must be a gain envelope, not only a shorter `src.start` duration.

Validate Milestone A before moving on.

## 3. Milestone B — active skill UX + melee + shotgun

Scope:
- external P1 cooldown HUD;
- Newbie invalid J is a true no-op;
- all five melee corrected;
- shotgun-family diagonal traversal.

Known defect to reproduce:
- melee ricochet cap currently has off-by-one risk.

Required invariants:
- exact wall-bounce maxima: Axe 1, Club 1, Spear 2, Sabre 3, Dagger 4;
- thrown melee preserves weapon-specific scale and motion;
- thrown melee release origin is the actual equipped weapon/hand area;
- swept collision remains;
- pin remains ~1s;
- fighter direction remains independent;
- Newbie no-target J produces no buffered future activation;
- shotgun TTL is derived from arena travel requirement rather than arbitrary short lifetime.

Validate Milestone B before moving on.

## 4. Milestone C — Arsenal Quest V1

Implement the 20-stage ladder exactly as specified by the contract.

Keep quest progression as data:
- one stage table;
- fixed P2 opponent per stage;
- P1 selection remains user choice;
- sequential unlock;
- replay completed stages;
- safe versioned local persistence;
- free-play Arsenal remains a separate path.

Do not duplicate the roster renderer.

Test at minimum:
- exact 20-entry order;
- stage 1 PAINTER;
- stage 10 ELECTRIC;
- stage 20 MONK resolving to live KUNGFU;
- locked stage rejected;
- win 1 unlocks 2;
- persistence survives reload;
- malformed save falls back safely;
- free play still launches normally.

Validate Milestone C before moving on.

## 5. Milestone D — integrated owner-quality validation

Run the complete accepted regression suite plus all new tests.

Required:
- asset build;
- headless;
- Vite build;
- real Chrome/browser suite.

Do not weaken old gates to make the revision pass.

When a current behavior is a bug:
1. reproduce it with a meaningful failing check or instrumented assertion where possible;
2. implement the fix;
3. prove that check now passes.

For UI/animation/feel requirements, browser execution is mandatory.

Inspect at normal speed:
- handgun vs rifle vs M249 vs Snipex relative scale;
- at least six distinct detached gun exits;
- rarity pickup under-light;
- five melee strike/throw/pin/exit flows;
- shotgun pellet travel;
- cooldown HUD;
- Newbie valid and invalid J;
- quest map and stage transitions.

Screenshots are evidence for static visual states. They do not replace observing motion.

For audio:
- instrument/inspect the WebAudio gain envelope and landing-event timing;
- also audition in browser if the environment supports audible playback;
- never claim subjective audio quality solely from a static unit test.

## 6. Stop-and-fix rule

If a milestone validation fails:
- repair it before advancing;
- do not defer a known regression to the final sweep.

If implementation reveals that a contract requirement cannot be met because of a genuine source/platform limitation:
- document the exact limitation and evidence;
- preserve completed work;
- continue all independent milestones;
- report the blocker at the end.

Do not stop for ordinary implementation choices that the frozen contract already resolves.

## 7. Scope control

Do not redesign already accepted systems unless this revision explicitly supersedes them.

Preserve:
- 30-item rarity pool and tiers;
- shield counter architecture;
- KeyJ manual-skill gate;
- Newbie 10s successful-activation cooldown;
- 3.0s spawn cadence;
- accepted gun firing identities and balance;
- muzzle/casing anchor work;
- approved SFX source bundle;
- sanitized VFX;
- arena no-text rule.

No unrelated refactors.

## 8. Git discipline

Work only on:
`arena/01a0cf5e-apex-chaos`

Do not move:
`playtest/arsenal`

Do not modify:
`main`

Keep commits scoped and reviewable.

## 9. Completion condition

Do not report complete until:
- all four milestones are marked complete in the execution plan;
- all required automated and browser validations pass;
- normal-speed visual review has been performed;
- no known contract violation remains unreported.

Final report must contain facts, not a generic summary:

1. implementation SHA;
2. evidence/CI SHA and run;
3. headless/browser totals;
4. files changed;
5. global gun-scale proof and representative size measurements;
6. six representative detached-exit evidence references;
7. single rarity-under-light proof;
8. gunshot fade-envelope proof;
9. casing/hull floor-contact audio proof;
10. cooldown HUD evidence;
11. Newbie invalid-J no-op evidence;
12. five-melee exact bounce/scale/pin results;
13. shotgun diagonal-travel result;
14. Quest stages 1/10/20 + persistence proof;
15. remaining genuine blockers only.
