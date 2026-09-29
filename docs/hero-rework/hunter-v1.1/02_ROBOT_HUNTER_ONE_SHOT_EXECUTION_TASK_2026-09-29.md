# ROBOT PASSIVE COMPLETION + HUNTER FINAL GOLD — ONE-SHOT EXECUTION TASK

## Branch law

Continue on the SAME Arena session branch:

`arena/01a0ead6-apex-chaos`

Do not create/switch to another working branch for this task.
Do not merge `main` or `playtest/arsenal`.

Fetch remote first.

The following authority commits MUST be ancestors of the working HEAD before edits:

- original Robot passive authority: `7f447e95c9eb0e2028fefa1d61e20d9c3bc68a88`
- original Hunter final gold authority: `9d0c7b2dcd5054828236841fb55ada740e584257`
- QA non-mutating workflow correction: `4845b5c9024965e7cd0818afc96c26586382b898`
- Robot truthful-refund authority correction: `a4d8838c0fe61da47827e356ac2527231e76128c`
- Hunter gold/gameplay mapping correction: `ef7323bdf3860523112538787359ee33e9064252`

Historical automated commits named like:
`chore(arsenal): refresh real-browser evidence [skip ci]`
may already exist in branch ancestry. They are not product authority.

The Arena self-mutating QA workflow has now been corrected: current QA should upload artifacts/status without committing evidence or dependency metadata back into `arena/**`.

If the previous Arena task is fully pushed and the local worktree is clean, fast-forward/reset the local disposable session worktree to the current remote tip of the SAME Arena branch before beginning.

## Required Hunter attachment

The task must be accompanied by the exact owner HTML:

`HUNTER_ALT_FINAL_V9_ROOT_TRAP_SAFE_P(1).html`

Verify:
SHA-256 = `c8cde28f346bbbd99de0c448ccfb396eae210e4928436850ef82b488d765fc88`

If the attached source hash does not match, STOP rather than implementing from memory or an older Hunter prototype.

After verification, copy/bridge the exact gold HTML into a stable repo authority path so future Agent sessions do not depend on the chat attachment. Preserve the exact bytes and record the SHA.

## Read before editing

1. `docs/agent-authority/VIBECODE_SKILL.md`
2. `docs/hero-rework/robot-final/01_ROBOT_PASSIVE_COMPLETION_AUTHORITY_2026-09-29.md`
3. `docs/hero-rework/robot-visual-cleanup-diagnostic/README.md`
4. `docs/hero-rework/hunter-v1.1/00_GAMEPLAY_CHECKPOINT_2026-09-29.md`
5. `docs/hero-rework/hunter-v1.1/01_FINAL_GOLD_INTEGRATION_AUTHORITY_2026-09-29.md`
6. exact attached Hunter HTML in full
7. current production:
   - `public/game/hero-rework/heroRegistry.js`
   - `public/game/hero-rework/heroMechanicsRuntime.js`
   - `public/game/hero-rework/heroReworkRuntime.js`
   - `public/game/hero-rework/robotPresentationRuntime.js`
   - `public/game/ui/apexCombatHudRuntime.js`
   - relevant Arsenal projectile/weapon/runtime code

Do a short source-conflict audit before edits:
- old Hunter mechanics vs V1.1;
- any old Hunter visual/runtime path that could double-render or double-run;
- ability controller support needed for charges;
- multiple trap ownership;
- high-speed swept contact;
- Robot passive/HUD event ownership.

Do not turn this preflight into a long report. Use it to prevent duplicated authority.

# PHASE 1 — FINISH ROBOT PASSIVE FIRST

This is a bounded micro-completion.

Implement exactly:
- production thresholds `[150,300,450,600,750,900]`;
- existing refund ladder unchanged;
- existing A1-first / A2-second refund-targeting semantics unchanged;
- cumulative credited realized damage, not LIVE BURST damage;
- match reset clears cumulative milestone state.

Integrate perceptible feedback into the existing universal combat side panel:
- no new standalone HUD;
- preserve LIVE BURST behavior exactly;
- Robot-only persistent six-step milestone read;
- show next threshold while one remains;
- crossing feedback uses existing panel heat/punch grammar;
- exact actual refund slot + ACTUAL APPLIED seconds only when a cooldown was actually reduced;
- compute before/after cooldown so clamp-to-zero cannot overstate the refund;
- if both A1 and A2 are READY, milestone still advances but there is NO upgrade/refund event/SFX claim;
- milestone #1 visibly registers but must not falsely claim a refund.

Preserve single-dispatch Robot passive audio/events.

## Robot proof

Real production gameplay:
- pre-150;
- 150 crossing;
- 300 crossing with A1 on cooldown -> verified 0.5s reduction;
- a crossing where selected cooldown remaining is smaller than nominal refund -> HUD/event shows only the actual removed amount;
- later crossing with A1 clear and A2 cooling -> verified A2 refund under existing law;
- crossing while both skills are READY -> milestone only, no fake upgrade/refund presentation;
- LIVE BURST expires after silence while Robot cumulative state persists;
- new match resets Robot cumulative state;
- no duplicate passive audio/event dispatch.

Run focused Robot gates + build.

Then create and PUSH a small crash-recovery commit:

`fix(robot): activate passive milestones and HUD feedback`

Do not stop or wait for owner after this checkpoint unless a blocker exists. Continue immediately to Hunter.

# PHASE 2 — HUNTER FINAL V1.1 + GOLD PORT

The attached HTML is the visual/motion golden master.

## Core integration law

PLAYER-VISIBLE GOLD IS HARD.
ENGINE PLUMBING IS SOFT.

Do not reinterpret the gold loosely.

### A1

Production:
- 3 starting/max charges;
- sequential 6.5s recharge;
- max 3 active traps;
- 46 radius;
- 6.0s lifetime;
- 1.25s root.

The Hunter body placement, plant, snap-back/retreat and recovery MUST follow the exact gold HTML temporal/articulation profile.

Do NOT use a generic reverse dash or new hand-chosen A1 timing.

IMPORTANT spatial mapping:
- the standalone HTML is staged horizontally and uses fixed world-left/world-right offsets;
- production must map that authored axis to Hunter's actual pre-cast locomotion direction;
- the post-plant yank is opposite the pre-cast movement direction;
- if nearly stationary, use last meaningful locomotion/facing direction;
- the snap-back must move the AUTHORITATIVE combatant body/hitbox, not only the renderer;
- clamp/resolve against arena/world collision;
- after recovery, cleanly resume native APEX locomotion.

Three charges do not mean skipping the signature gold cast animation.

The current AbilityController has no native charge model, so implement the smallest safe charge extension/state required for Hunter A1:
- start/max 3;
- successful cast consumes exactly 1;
- failed/blocked cast does not consume a charge;
- recharge is sequential, one charge every 6.5s;
- reaching full charges stops recharge cleanly;
- rematch/new match resets to 3;
- active-trap cap failure must not consume a charge.

Expose truthful A1 charge/recharge state through the EXISTING skill/cooldown HUD or mode slot. Do not add a separate Hunter HUD.

Each logical trap owns an independent gold-derived visual state and lifecycle. A new cast must never reset an older still-active trap.

### A2

Production:
- 12s cooldown;
- TOTAL prelaunch/coil envelope = 0.16s;
- ~2200 px/s physical chase;
- max 0.50s chase;
- continuously steer/re-target current opponent;
- swept body collision;
- direct damage 0;
- contact -> WEAK 3.0s, incoming damage ×1.25.

Visually preserve the gold:
`read -> coil -> snap -> correct -> catch`

The standalone gold uses a much longer READ+COIL+HOLD before launch (~0.665s). DO NOT restore that long delay: it conflicts with the owner-approved easier-play V1.1.

Instead:
- preserve the gold phase ordering, poses, compression and anticipation language;
- proportionally compress/re-time the prelaunch sub-beats into the approved 0.16s total envelope;
- once launched, the world path continuously chases the live opponent;
- preserve travel/catch motion and a readable correction accent;
- do not fire the correction VFX every steering tick.

No teleport.

### Passive

- active only while opponent is Trapped OR Weak;
- 24% eligible collision-course projectile dodge;
- physical dodge 95;
- lockout .45s;
- no invisibility;
- no post-dodge invulnerability;
- T6 excluded.

Presentation follows gold incoming-shot -> foreleg-slip language.

## Hunter safety constraints

- preserve native APEX locomotion outside authored skill displacement;
- no generic old Hunter visual fallback underneath/over the gold renderer;
- no duplicate trap mechanics;
- no fake demo prey/projectiles in production;
- no global camera ownership takeover;
- no unrelated hero changes;
- no balance improvisation.

## Hunter required real-browser proof

Produce a concise owner-review package, not a huge evidence project:

1. idle + normal locomotion;
2. A1 full sequence at normal speed while moving one direction, then again from the opposite direction, proving the recoil maps against movement and is physical;
3. three consecutive valid A1 casts showing independent traps plus truthful 3/3 -> 2/3 -> 1/3 -> 0/3 charge HUD and sequential recharge;
4. real opponent root;
5. trap release/expiry;
6. A2 against a target that changes direction during chase;
7. A2 real contact -> zero direct damage + WEAK;
8. passive dodge under valid prey state;
9. passive no-proc condition without prey state;
10. T6 exclusion;
11. real weapon/projectile environment interaction;
12. short 60–90s owner acceptance reel covering the above at normal game scale.

Screenshots may supplement; motion proof is primary because Hunter gold is motion-heavy.

## Focused validation

At minimum:
- production build;
- new Hunter deterministic gates for A1 charges/recharge/multiple traps;
- A2 continuous chase + swept contact;
- WEAK = 3s / ×1.25 / zero skill damage;
- Killer Instinct eligibility + 24% deterministic RNG gate + lockout + T6;
- existing Robot R1–R9 plus new passive production threshold gates;
- Slime owner-fix safety gates;
- launcher/browser smoke;
- runtime errors = 0.

Do not run a repository-wide evidence marathon before owner review.

## Commit / stop

After Hunter implementation and focused proof, create and push one Hunter candidate commit after the Robot checkpoint.

Report:
- branch;
- Robot checkpoint SHA;
- Hunter candidate SHA;
- bridged Hunter gold repo path + verified SHA;
- exact production files changed;
- Robot passive proof verdict;
- Hunter mechanic gate results;
- Hunter visual evidence/reel paths;
- any deliberate adaptation from gold and why it was invisible/plumbing-only.

Then STOP.

Do not call Hunter final.
Do not call Robot or the whole Hero Rework release-final.
Wait for ChatGPT hostile audit + owner review.
