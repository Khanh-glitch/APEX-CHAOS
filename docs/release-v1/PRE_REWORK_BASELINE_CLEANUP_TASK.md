# APEX CHAOS — PRE-REWORK BASELINE CLEANUP TASK

## Authority / baseline

- Repository: `Khanh-glitch/APEX-CHAOS`
- Work branch: `arena/01a0dc5e-apex-chaos`
- Exact baseline when this task was authored: `1494056f16fcb4b2a1a77b320352a410fee6250c`
- Do **not** promote or modify `playtest/arsenal`.
- This is the last cleanup/stabilization pass before the planned hero rework.
- Do **not** redesign heroes, Quest, economy, progression, online/ranked, or the final release roster in this task.
- Fetch remote and verify the branch tip before making changes. If the branch moved, preserve all newer accepted work and rebase/port this task onto the live tip rather than overwriting it.

The owner wants a real production pass, not a demo and not a documentation-only audit. The deliverable is working code, tests/evidence, and measured before/after results.

---

# ARENA AGENT AUTONOMOUS EXECUTION & CAPABILITY-EVALUATION PROTOCOL

This task will be started in a **new Arena Agent Mode chat**. Arena assigns an undisclosed orchestrator model/session. The owner will use this **entire real production mission** to decide whether the session is strong enough to trust with later Hero/Quest rework.

This is **not** a staged qualification that waits for owner approval. Run the mission autonomously from start to finish in one session whenever technically possible.

Do **not** try to guess or claim the hidden model identity. The capability test is behavioral: repository understanding, implementation quality, architecture judgment, bash/browser recovery, visual QA, scope discipline, evidence quality, and Git safety.

## Q0 — session/branch safety

Before editing:

1. `git fetch` and inspect the actual Arena session branch, remote refs, HEAD, worktree status, and recent log.
2. The accepted development history immediately before this unattended mission is the live `arena/01a0dc5e-apex-chaos` tip. A permanent fallback branch exists at `safety/pre-rework-agent-baseline-20260927`.
3. Arena normally provides the session its own work branch/repository copy. **Work and push only on the Arena session branch.** Do not move, force-update, merge into, or directly push implementation commits to `arena/01a0dc5e-apex-chaos` or `playtest/arsenal`.
4. If the accepted branch has moved, preserve newer accepted work and deliberately base/port onto it. Never reset accepted history backwards.
5. Never force-push, delete remote branches, or perform destructive ref changes in this mission.
6. The fallback branch is an emergency recovery point, not a branch to overwrite.

## Q1 — one-shot autonomous mission policy

The owner will **not** be present to approve intermediate steps.

Therefore:

- Do not pause after a checkpoint asking permission to continue.
- Do not return a plan-only response when implementation is possible.
- Use engineering judgment for implementation details that are not explicitly specified.
- When a detail is genuinely ambiguous, choose the **smallest reversible implementation consistent with the owner intent**, document the decision, and continue.
- Ask/stop only for a true external blocker that makes meaningful continuation impossible (for example: missing repository access or a required secret that blocks every viable implementation path).
- A problem in one sub-area is not automatically a reason to abandon independent remaining sub-areas.

The session should complete all production phases below and return only after final validation/evidence, or after preserving every valid checkpoint it could complete if a genuine blocker remains.

## Q2 — checkpointing for crash recovery, not for owner approval

Arena sessions can crash or lose useful local work if a long turn ends before work is pushed. Use checkpoints aggressively enough to protect work, but not so aggressively that the implementation becomes fragmented.

Required checkpoint sequence:

### Checkpoint 1 — boot/loading truth
Complete the loader/menu-interactive/BGM-warmup architecture and measurement work.

Commit + push a coherent validated checkpoint, preferably:
`perf(boot): align loader with menu-interactive readiness`

Then **continue automatically**.

### Checkpoint 2 — runtime asset delivery
Complete practical tiered loading + runtime asset-format/size optimization that is justified by measurement.

Commit + push, preferably:
`perf(assets): tier and optimize runtime asset delivery`

Then **continue automatically**.

### Checkpoint 3 — Stormbreaker gameplay / red-tier rules
Complete authoritative balance, spawn-lightning gameplay, red-tier interaction immunity, pursuit/homing, and related deterministic tests.

Commit + push, preferably:
`feat(arsenal): harden Stormbreaker gameplay and red-tier rules`

Then **continue automatically**.

### Checkpoint 4 — weapon/heal presentation
Complete Stormbreaker body presentation, mirror transform, fast-spin/afterimage presentation, firearm-part semantics, firearm scale normalization, heal-tier shadows, and browser evidence.

Commit + push, preferably:
`fix(arsenal): normalize weapon and heal presentation`

Then run final regression/evidence and finish the mission.

Checkpoint boundaries may shift slightly if the real dependency graph makes a different split cleaner, but:
- do not keep the entire mission uncommitted;
- do not create meaningless micro-commits;
- every checkpoint must be internally coherent enough to recover from.

## Q3 — loop / crash / bash recovery rules

These are guardrails, not reasons to be timid:

- After each coherent validated checkpoint, **commit and push before starting the next expensive/risky phase**.
- Do not keep a large multi-file working tree uncommitted while running long browser suites or conversion/generation jobs.
- If the same command or same implementation approach fails twice, inspect the failure and change the hypothesis/approach rather than blindly repeating it.
- Never repeat an unchanged failed approach more than three times.
- Use sane timeouts for commands that can hang. If a process stops making meaningful progress, terminate it and inspect logs/process state.
- Distinguish pre-existing failures from failures caused by the current diff before changing unrelated code.
- Identify generators/source-of-truth before editing generated manifests/assets.
- Convert assets in bounded, verifiable groups; preserve source masters/provenance and verify runtime references before deleting/replacing delivery files.
- If context exhaustion/tool instability/crash risk becomes apparent, **commit + push the currently validated state immediately**, then continue if possible. Never leave substantial completed work only local.
- Do not claim visual completion from constants/tests alone; inspect actual browser evidence.
- Do not hide a broken sub-area by weakening tests or deleting evidence.

## Q4 — capability evidence to leave behind

The owner will evaluate whether this Arena session is worth reusing for the upcoming Hero rework.

Do not waste time writing a self-rating. Instead, make the mission itself auditable.

At final report include a concise **execution trace**:
- checkpoints + pushed SHAs;
- meaningful failed commands/approaches and how each was recovered;
- any architectural decision made where the spec left freedom;
- any requirement intentionally left incomplete and why;
- final test/evidence state.

A strong session will naturally show:
- correct live-Git handling;
- strong dependency-graph understanding;
- measured rather than guessed loading improvements;
- targeted asset optimization rather than mass conversion;
- clean separation of Stormbreaker gameplay vs presentation;
- correct visual QA rather than test-only confidence;
- rational recovery from failures;
- low scope drift;
- clean pushed checkpoints;
- honest limitations.

---

# Mission

Complete the entire **Pre-Rework Baseline Cleanup** autonomously in this one Arena session.

Production phases:

1. **Checkpoint 1 — boot/loading truth + menu interactivity + BGM warmup**
2. **Checkpoint 2 — tiered runtime loading + measured asset delivery optimization**
3. **Checkpoint 3 — Stormbreaker gameplay + red-tier interaction rules**
4. **Checkpoint 4 — weapon/heal presentation + scale normalization + final evidence**

Do not wait for owner approval between phases. Commit/push each coherent phase for recoverability, then continue.

Do not spend this task inventing unrelated work. Everything below is intended to ship or directly support the release build.

---

# CHECKPOINT A — BOOT / LOADING / ASSET DELIVERY

## A1. Fix loading truth

Current problem: the visible loader can appear effectively finished while the application is still waiting for `apexEngine.js` and the required classic runtime chain before `gameReady` becomes true. The player sees "loaded" but still waits.

Required behavior:

- Loading percentage must represent the resources required for **menu interactivity**, not just the image preload count.
- Never show 100%/READY while a required menu-interactive dependency is still pending.
- The loader should disappear as soon as the menu is genuinely usable.
- Do not artificially hold the loader to hide unrelated background loading.
- Preserve a short visual fade only if it is presentation-only and does not materially delay interaction.
- Add measurable boot marks for at least:
  - boot start
  - critical shell ready
  - menu runtime ready
  - menu interactive
  - loader hidden
  - background warmup start/end

Record actual before/after timings in the task report/evidence.

## A2. Reclassify runtime loading by need, not by historical placement

The current `BOOT_GAME_RUNTIMES` contains many fighter-specific runtimes that are not required just to display/use the menu.

Refactor the manifest/loading policy into practical tiers:

### Tier 0 — critical boot shell
Only what is required to render the loading shell and establish the minimum app bridge.

### Tier 1 — menu interactive
Only what is required so the menu is visible, responsive, navigable, and its immediate UI/audio bootstrap can work.

### Tier 2 — likely-next background warmup
After menu interaction is available, warm likely next resources in the background/idle period. At this stage Quest is the future primary shipping experience, so Quest/select/common combat dependencies should be prioritized over legacy modes.

### Tier 3 — intent-based
When a player expresses intent for a route (click/press, or safe hover/focus intent where appropriate), raise that route's runtime/assets to high priority.

### Tier 4 — match-specific
Load/decode assets that are actually needed by the selected fighters, arena, common Arsenal set, and current encounter before the match starts.

### Tier 5 — deep lazy / rare / non-shipping
Rare/T6-only assets, Lab-only extras, non-current fighter assets, and legacy-mode assets should not sit on the first-interaction critical path.

Do not create a huge new framework if a small manifest + loader refactor solves this cleanly.

## A3. Background loading must not cause first-play hitching

The goal is not merely "menu appears early". The next likely action should also feel immediate.

- Use cache warming/prefetch intentionally.
- Decode images before the frame on which they are first required where practical.
- Do not eagerly decode every image in the repository.
- Do not let background work monopolize the main thread.
- Preserve deterministic route loading: if the user clicks a route before background warmup finished, that route becomes priority and the action waits only for its own required dependencies.
- Add a small non-blocking route-loading affordance only if a real route still needs noticeable time; do not send the user back to the global boot loader.

## A4. Menu music

Current implementation creates `menu_bgm.mp3` with `preload='none'`, so the first allowed play can also become the first real fetch.

Required:

- Warm/preload the menu BGM in the background before the first user gesture when possible.
- It must **not** block menu interactivity.
- Respect browser autoplay policy: do not attempt hacks to force audible autoplay.
- On the first allowed user interaction, playback should start from already-warmed data as promptly as browser policy permits.
- Preserve pause/resume behavior for hidden tabs/focus changes.
- Add a browser test/evidence path proving audio is prepared before the first allowed play request, without requiring autoplay.

## A5. Runtime asset format/size optimization

Do **not** blindly convert every PNG to WebP or every WAV to another codec.

Audit runtime-delivered assets and classify them:

- `SHIPPING_HOT`
- `SHIPPING_LAZY`
- `LEGACY_NON_SHIPPING`
- `SOURCE_MASTER_PROVENANCE_ONLY`

Rules:

- Optimize first the assets actually delivered by the shipping path.
- Large runtime PNGs should be converted/resized to WebP (or another demonstrably smaller compatible runtime format) when it materially reduces transfer/decode cost without visible quality loss.
- Preserve source/master files where provenance/editing requires them, but source masters must not be accidentally loaded by the game.
- Small PNGs of only a few KB do not need conversion merely for format consistency.
- Runtime audio should use a compressed browser-compatible delivery asset where that materially reduces size; keep WAV masters only as source/provenance when needed.
- Do not spend time optimizing large assets belonging only to modes already planned for removal from the shipping product unless they are still on the current hot path.
- Update all runtime references/manifests to the optimized delivery files.
- No broken URLs, no MIME mismatch, no first-use decode hitch introduced by conversion.

Produce a concise size report:
- hot-path bytes before/after
- menu-interactive bytes before/after
- number of runtime PNG/WAV assets replaced
- largest remaining shipping hot/lazy assets

---

# CHECKPOINT B — WEAPON INTEGRITY

## B1. Stormbreaker balance

Current confirmed-hit production damage is effectively ~546.

Owner requirement:

- Final observed confirmed-hit damage becomes **446** (100 less than current).
- Do this at the authoritative configuration/damage path; do not stack a hidden one-off post-damage subtraction that will become technical debt.
- Current confirmed-hit stun is 1.0s; increase it to **2.0s**.
- Keep the existing rare/red-tier identity and spawn probability unless another requirement below explicitly changes behavior.

Tests must assert actual HP delta and actual stun duration, not only config constants.

## B2. Remove Stormbreaker global spawn slow

Delete the current global slow behavior for Stormbreaker spawn.

There must be:
- no `slowMult` gameplay effect on both fighters merely because Stormbreaker exists on the floor;
- no stale "SLOWED" UI/state from this mechanic.

## B3. Floor lightning becomes a real contact hazard

The visible Stormbreaker spawn/floor lightning is no longer presentation-only.

Important owner clarification:
**Do not implement this as an invisible line that simply crosses a fighter and silently applies stun.**

Required behavior:

- Use the **actual visible bolt polyline/branch geometry** (or an equivalent collision representation derived from that exact geometry) as the hit authority.
- When a visible floor-lightning bolt touches a fighter circle, create a discrete lightning-contact event at/near the real contact point.
- Each contact stuns that fighter for **1.0 second**.
- Both fighters are valid targets; Stormbreaker has no owner on the floor.
- No damage is added unless separately specified in the future.
- A single bolt/pulse must not re-apply stun every frame. Add a bounded per-pulse/per-fighter hit gate.
- The hit must be visually readable:
  - contact flash at the intersection;
  - electrical crawl/branching that travels **into/across and around the fighter body**, not just a line behind it;
  - a short victim crackle/residual effect so the viewer can tell which fighter was actually struck.
- The visual contact effect should be local and brief; do not turn every floor bolt into a screen-filling explosion.
- Add deterministic tests that place HERO/RIVAL on and off a generated bolt path and prove hit/no-hit + 1.0s stun.

## B4. Stormbreaker sprite size vs VFX size

Reduce the **Stormbreaker body sprite** slightly relative to the current version.

Use evidence rather than an arbitrary huge reduction. A first-pass body scale around the low-90% range of current size is acceptable if visual evidence supports it.

Crucial separation:

### Shrink with the body
Effects that are physically attached to the body:
- weapon-local blue aura
- body-local lightning lattice
- local glow that traces the weapon silhouette
- anchor positions tied to the weapon surface

### Do NOT shrink globally
- arena-edge lightning reach
- floor discharge reach
- impact burst radius
- scene flash
- distant lightning
- any world-space effect whose meaning is not "the weapon body's physical envelope"

Do not repeat the old mistake where shrinking the sprite makes the whole T6 presentation feel tiny.

## B5. Stormbreaker red-tier floor shadow

Add a clearly readable but tasteful red-tier floor shadow/glow under Stormbreaker while it is on the floor.

- It is not a giant opaque circle.
- It must read as "red tier / exceptional item".
- Keep the blue electrical body language; the red floor shadow communicates rarity rather than replacing the lightning palette.
- Structure this so future red-tier items can reuse the semantic red-tier floor treatment.

## B6. Mirror flip — NOT 180-degree rotation

Owner correction:

The desired held/flight change is a **mirror reflection of the current visual**, not a `+ Math.PI` rotation.

Required:

- Floor orientation remains as currently accepted unless needed for attached-anchor correctness.
- Held Stormbreaker sprite is mirrored relative to its current presentation.
- Flight Stormbreaker sprite is mirrored relative to its current presentation.
- Use a local reflection transform / negative local scale on the weapon presentation as appropriate.
- World aim, target trajectory, physics velocity, collision, and homing direction must not be reversed.
- Weapon-local anchors/electricity/aura that visually stick to the weapon must mirror with the body so the effect does not appear detached.
- Remove/replace the old `flightVisualOffsetRad: Math.PI` approach if it is only simulating a flip by rotation.
- Evidence must include a static held frame where mirror orientation is obvious, plus a flight frame.

## B7. Red-tier hero-interaction immunity

Make this a semantic **red-tier/T6 weapon rule**, not a Stormbreaker-only pile of special cases.

Red-tier equipment on the floor must not be manipulated by hero skills such as:
- magnetic pull / remote pull
- dash-to-weapon auto acquisition
- teleport/reposition/swap of the weapon
- force drop / disarm
- weapon reroute
- barrier/cage logic whose purpose is to move or deny the weapon itself
- future generic "manipulate pickup" hooks

Important:
- Fighters can still physically move to and pick up a red-tier item normally.
- The fighter holding a red-tier item is **not** immune to hero CC/status merely because of the weapon.
- Expose one clean authority such as `isHeroManipulablePickup(id)` / `heroInteractionImmune` that future hero rework code can query.
- Update NEWBIE's current dash-to-weapon behavior to respect the rule now.
- Add tests proving a normal tier remains manipulable while T6 does not.

## B8. Stormbreaker homing pursuit

Stormbreaker flight should no longer behave like a normal thrown melee that can simply miss an opponent and continue away.

Required feel:
- on release, aim toward the living opponent;
- while in flight, continuously steer/pursue that opponent;
- no teleport/snap-to-target;
- maintain the fast/heavy projectile identity;
- use swept collision so high speed cannot tunnel through the target;
- if the opponent changes direction, Stormbreaker visibly curves to continue pursuit;
- define a bounded lifetime/failsafe so a pathological state cannot create an immortal projectile;
- do not let ordinary hero pickup-manipulation mechanics redirect a red-tier Stormbreaker.

This should read as a **predatory/hunting throw**, not a generic homing missile UI effect.

## B9. Stormbreaker flight spin / cyan afterimage

Do not optimize for making the axe easy to read frame-by-frame during flight.

Owner wants:
- extremely fast violent spin;
- short cyan-tinted afterimages distributed along the immediate recent trajectory;
- the viewer perceives a dangerous spinning electrical mass;
- no long snake/tail effect.

The current numeric spin rate is already high, so judge the final result visually rather than merely increasing the constant.

Keep the afterimage pool fixed/bounded and performance-safe.

## B10. Static firearm integrity — parts are actions, not decorations

Some firearm presentations currently make casings/accessories/parts read as if the gun is visually disassembled while sitting on the floor or being held.

New law:

### Static states
Floor and equipped firearms must read as **complete intact weapons**.

Do not show a casing, magazine, shell, attachment or detached sub-part as static decoration around the weapon unless it is physically supposed to be external in the intact design.

### Event states
Use those authored parts only when an actual action justifies them:
- shot -> casing ejection
- shotgun shot -> shell ejection
- reload (only where an actual reload animation/state exists) -> magazine/shell manipulation
- weapon consume/drop -> relevant body/magazine/hull physical exit if the weapon's authored behavior calls for it
- discard -> detached part only when tied to the discard animation

Do not invent a reload gameplay loop just to show a magazine if the current weapon is consumed after its firing sequence.

Audit the complete staged firearm set for this issue, not only one example.

## B11. Firearm scale normalization

Do not make every gun the same size, and do not create cartoonishly extreme size gaps.

Use the **current rifle family** as the primary visual reference. The current AK-47 / M16 / Z15 visual scale is the baseline family the owner considers closest to correct.

Normalize around that reference while preserving real class identity:

- compact pistol < heavy pistol < SMG < rifle
- shotgun/LMG/precision may be larger where their silhouette justifies it
- compact guns must still look compact
- do not let pistols or SMGs look almost rifle-sized
- do not shrink pistols into tiny icons

Do not rely only on source pixel dimensions. Judge rendered world silhouette relative to fighter size and the accepted rifle baseline.

Required evidence:
- one clean firearm lineup/grid with all firearms rendered against the same fighter/world reference and no perspective difference;
- before/after measurements or `FIREARM_LONG_SIDE` table;
- verify floor/equipped/exit modes preserve consistent relative scale.

## B12. Heal pickup floor-shadow color by heal tier

Current heal floor treatment is essentially the same green for every heal object.

Change only the **floor shadow/glow rarity language** so each heal tier reads by tier.

Map:
- H1 -> T1-style neutral/white-gray
- H2 -> T2 green
- H3 -> T3 blue
- H4 -> T4 purple
- H5 -> T5 orange/gold

Use the same tier color authority already used by Arsenal where possible rather than duplicating magic hex values.

Do not recolor the authored heal item art itself unless necessary; the requirement is specifically the floor shadow/glow identity.

Add one evidence frame/grid showing all five heal pickups and their tier shadows.

---

# Asset/cache implications of Checkpoint B

If weapon/heal images are converted to optimized runtime formats in Checkpoint A:
- update the generated C-set/metadata safely;
- preserve source dimensions/anchors;
- rebuild generated files through their generator where one exists rather than manually editing generated output;
- ensure Stormbreaker body-local anchor math still matches the displayed body after optimization/mirroring/scaling.

Cache-bust public classic runtimes and changed public assets correctly so Cloudflare cannot serve stale bytes.

---

# Validation / acceptance

Do not claim completion based only on unit constants.

Minimum required:

## Checkpoint A
- production build succeeds
- loader first-interaction test in real browser
- menu can be interacted with immediately when loader disappears
- BGM is warmed before first permitted playback request
- no broken runtime/asset URLs
- before/after boot timing report
- before/after shipping hot-path size report
- no first-route regression in Quest/Arsenal entry

## Checkpoint B
- Stormbreaker final confirmed-hit HP delta = 446
- confirmed-hit stun = 2.0s
- no global Stormbreaker spawn slow
- visible lightning geometry can hit either fighter and applies exactly one 1.0s stun per pulse/contact gate
- visible victim electrical-contact effect is present
- body sprite is slightly smaller while world-space lightning/impact remains large
- red-tier floor shadow exists
- held/flight are **mirror-flipped**, not 180° rotated
- red-tier pickup resists hero manipulation; ordinary tier still works
- Stormbreaker pursues moving opponent and does not simply miss straight past
- flight visually reads as fast spin + short cyan trajectory ghosts, no long tail
- static firearm states are intact; parts appear only as event-driven motion
- firearm lineup scale is normalized using current rifles as baseline
- heal H1..H5 floor shadows use tier-appropriate colors
- Arsenal Lab remains functional
- existing blood/splatter behavior is preserved
- no unrelated hero/Quest/economy changes

Run existing relevant headless + real-browser suites. Add focused deterministic gates for the new behaviors. If an existing pre-task failure is still present, report it separately rather than silently altering unrelated gameplay to make CI green.

---

# Evidence required

Produce or refresh browser evidence that makes owner review easy:

1. loader/menu-interactive timing capture/report
2. asset-size report
3. Stormbreaker floor spawn with red shadow and lightning hazard
4. Stormbreaker lightning actually striking HERO
5. Stormbreaker lightning actually striking RIVAL
6. held mirrored Stormbreaker
7. flight pursuit + fast-spin cyan afterimages
8. Stormbreaker confirmed impact
9. firearm full lineup after scale normalization
10. representative casing/shell action frame proving static gun remains intact
11. H1-H5 healing pickup tier-shadow lineup

Do not use debug overlays that obscure the subject.

---

# Commit discipline

Use the checkpoint sequence defined in Q2. The purpose is recovery and auditability, **not owner approval**.

Do not stop after a successful intermediate checkpoint. Push it and continue automatically.

If a checkpoint exposes a genuine blocker:
- preserve and push all validated work first;
- attempt a different technically sound path;
- continue independent remaining requirements when possible;
- only end early if continuation is genuinely impossible or would require inventing owner intent.

At the end report:
- exact final SHA
- all pushed checkpoint SHAs
- files changed
- concise execution trace: meaningful failures/recoveries and important judgment calls
- before/after boot metrics
- before/after asset bytes
- exact Stormbreaker gameplay values
- tests and browser gate totals
- evidence paths
- any remaining known issue

Stop after this mission. Do not start hero rework without a new owner task.
