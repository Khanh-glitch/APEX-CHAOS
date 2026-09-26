# ARENA AGENT TASK — INTEGRATE STORMBREAKER AS THE FIRST RED-TIER FANTASY WEAPON

You are implementing Stormbreaker directly into the real APEX CHAOS game.

This is a production integration task, not a standalone demo.

You are receiving:

- `00_READ_FIRST.md`
- `01_STORMBREAKER_APPROVED_ASSET.png`
- `02_APPROVED_EXECUTABLE_REFERENCE_V9_NO_LONG_TAIL.html`
- `03_STORMBREAKER_VISUAL_GAMEPLAY_SPEC.md`
- `04_APEX_INTEGRATION_MAPPING.md`
- `06_OWNER_PLAYTEST_CHECKLIST.md`

Read all of them before implementation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. REPO / SESSION SAFETY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before editing:

1. Fetch latest remote state.
2. Print current branch and HEAD.
3. Re-read the current APEX project SKILL in full.
4. Re-read the newest authoritative / zero-context handoff in full.
5. Verify the single repository and branch you are authorized to modify for this Arena session.
6. Audit remote state before trusting any previous local work.
7. Do not assume the branch name solely from this package if the current handoff says otherwise.
8. Do not modify unrelated branches.
9. Do not work in a second repository during this task.

Known historical game branch has been `arena/01a0cf5e-apex-chaos`, but CURRENT live handoff/remote authority wins if it differs.

If the approved Stormbreaker asset must be placed into the game repo, copy/import this exact provided asset into the authorized game repository using the project's normal asset structure.

Do not require Asset Vault access for this task.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LOCKED PRODUCT DECISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stormbreaker is intended as APEX CHAOS's first red-tier fantasy weapon.

The owner has already iterated the visual prototype through many versions.

Do NOT redesign it from scratch.

Executable authority:

`02_APPROVED_EXECUTABLE_REFERENCE_V9_NO_LONG_TAIL.html`

Critical locked decision:

**THROW HAS NO LONG LIGHTNING TAIL.**

The owner explicitly rejected repeated attempts at:
- long center lightning
- blue ribbon
- hero tail
- vortex tail
- multiple long tail streams

Do not restore them.

The throw should read as:

VIOLENTLY SPINNING STORMBREAKER
+
SHORT LOCAL ELECTRICITY ACROSS THE WHOLE WEAPON

not:

STORMBREAKER
================ blue/lightning tail ================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. AUDIT BEFORE DESIGNING HOOKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the real current code paths for:

- weapon registry / definitions
- rarity / spawn tier
- weapon spawn lifecycle
- pickup ownership
- attack activation
- projectile or thrown-weapon movement
- collision / hit resolution
- damage
- stun / status effects
- movement modifiers / slow
- renderer / weapon sprite transform
- camera shake
- world / floor VFX layering
- SFX hooks
- performance / telemetry if present

Do not guess file names or architecture.

Integrate with what actually exists.

Do not rewrite the combat engine.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. APPROVED ASSET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use:

`01_STORMBREAKER_APPROVED_ASSET.png`

Preserve its visual identity.

Determine the correct crop/pivot/orientation from the real game rendering context.

The prototype's anchor coordinates are NOT authoritative production sprite coordinates.

If necessary:
- trim transparent bounds
- define pivot
- create optimized runtime derivative
- pre-scale/cache it

But do not redraw or replace the approved Stormbreaker art without owner instruction.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. RED-TIER ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stormbreaker should occupy the first red-tier / highest-fantasy weapon role.

Use existing rarity architecture if possible.

If red-tier presentation does not yet exist:
- add the smallest clean extension necessary
- avoid broad rarity refactors
- do not break current spawn distribution
- preserve all current accepted weapons

Stormbreaker's rarity should be visually/behaviorally obvious from its spawn presence, not only from a label.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. SPAWNED / UNCLAIMED STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When Stormbreaker spawns and nobody has claimed it:

### Required gameplay

Both fighters are continuously slowed.

The slow persists only while Stormbreaker is in the unclaimed floor state.

When Stormbreaker is picked up / leaves that state:
- remove the global slow cleanly
- do not leave stale modifiers

Use the real movement/status system.

Do not implement slow as fake render slowdown.

### Required VFX

Stormbreaker continuously crackles.

Electricity must visibly connect:
- different points on the axe head
- head to handle
- multiple handle sections
- rear/pommel region

The weapon should feel internally electrically connected.

It also emits repeated floor lightning pulses.

Use hierarchy:
- hero floor bolt
- optional supporting bolt
- limited branches
- brief topology mutation
- brief scene illumination
- controlled camera shake

Compared with the earliest prototype, the approved direction uses MORE floor lightning before pickup.

However:
do not make every frame maximum brightness.

The correct rhythm is:
charged idle
→ pulse
→ pulse
→ stronger pulse
→ brief visual recovery

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. PICKUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

On pickup:

- global unclaimed slow ends immediately
- brief claim flash
- short electrical connections may run from floor / fighter / weapon
- electricity then concentrates around the holder and Stormbreaker

Do not turn pickup into an arena-wide detonation.

Impact remains the biggest event.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. ATTACK / THROW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The attack is a heavy committed Stormbreaker throw toward the opponent.

Desired read:

- heavy release
- extremely fast rotation
- weapon becomes slightly visually smeared by rotation
- electricity stays local to the weapon
- collision feels violent

### Spin

The approved prototype significantly increased spin speed.

Do not make it rotate slowly enough that the sprite simply looks like a normal flying axe.

It should read almost like a rotating storm mass while remaining identifiable.

### Motion ghosts

Use a small number of lightweight rotational ghosts/afterimages.

Preferred:
- cached/pre-scaled weapon image
- ~2–3 useful ghosts
- low alpha
- no expensive per-frame image blur/filter

Ghosts should imply extreme rotation.

They should not look like three separate axes.

### Local electricity

During flight:

- use several anchor points distributed across the WHOLE weapon
- short arcs can connect those anchors
- small outward snaps may emit from different anchors
- arcs should rapidly change
- arcs should remain close to the weapon

Explicitly forbidden:
- long trail
- blue ribbon
- centerline beam
- rope connecting current position to previous path
- vortex tail
- long lightning following flight history
- a single fixed emission point in the center

No long throw tail means NO long throw tail.

Do not "improve" this decision.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. PERFORMANCE — THROW IS CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Earlier prototypes visibly lost frame rate because they:
- spawned too many bolt objects during flight
- regenerated jagged geometry frequently
- used many glow passes
- used expensive blur / shadow work
- layered many history effects at once

The approved smooth approach changed architecture.

Production should preserve the principle:

**fixed / bounded throw cost**

Preferred:
- pre-scale/cache large source sprite
- use lightweight cached ghost images
- a fixed small count of local electric paths
- no unbounded particle/bolt spawning during flight
- no per-frame expensive filter blur
- no large accumulation of active trail entities

Do not slow the throw animation to hide poor performance.

Measure actual browser/rAF performance under real gameplay workload.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. IMPACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

On CONFIRMED hit:

### Exact sequence

1. contact occurs
2. intense local white/cyan flash at actual hit point
3. Stormbreaker becomes visually hidden immediately after the flash
4. target receives real stun
5. arena-wide discharge fires
6. residual target body crackle remains briefly

The owner specifically does NOT want Stormbreaker sitting still/embedded in the opponent where the art can be inspected after hit.

The flash should visually cover the disappearance.

### Hit position

Use actual collision point if the engine provides it.

Otherwise use the best valid contact position available.

Do not always center the flash on target center if a true hit position exists.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. STUN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stormbreaker hit stuns the opponent.

Use existing status logic.

Do not fake it by stopping an animation only.

Stun duration is a BALANCE value.

The prototype's ~1.18 s is visual-demo reference only, not an unquestionable production number.

Choose/confirm a value consistent with current APEX balance and make it easily tunable.

Do not silently modify unrelated stun mechanics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. IMPACT DISCHARGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Successful hit produces the largest electrical moment.

Use:

- one hero discharge
- several major floor branches
- limited secondary branches
- target body crackle
- sparks
- scene illumination
- strong existing camera shake

Do NOT use:
- symmetric starburst
- equal brightness everywhere
- dozens of equally important bolts
- permanent cyan overlay
- uncontrolled shake stacking

The visual hierarchy must remain readable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. DAMAGE / GAMEPLAY TRUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not invent fake damage in the VFX system.

Use actual combat damage.

Do not change unrelated:
- firearm balance
- existing weapon multipliers
- critical system
- HP architecture
- skills
- pickup cadence
- current accepted spawn rules

Stormbreaker-specific damage can be added only through its own weapon definition/balance.

VFX never becomes gameplay truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. STATE CLEANUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verify clean transitions:

SPAWNED
→ PICKED UP
→ HELD
→ THROWN
→ IMPACT / MISS / RESOLVE

Important cleanup:

- floor slow removed on pickup
- no duplicate slow modifier after respawn/re-spawn
- no residual floor VFX attached to a weapon that has been picked up
- no long-tail entities because none should exist
- local flight arcs die with flight
- impact flash is transient
- stun expires correctly
- camera shake does not accumulate forever
- weapon lifecycle resolves correctly after hit/miss

Also test what happens if the throw misses.

Do not leave the weapon in a broken state.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. RENDERING ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respect current APEX layering.

Conceptually:

arena floor
→ floor-running lightning / low world illumination
→ actors / pickups as appropriate
→ Stormbreaker
→ local airborne electrical crackle
→ impact flash / discharge
→ damage numbers / high-priority combat feedback
→ HUD

Do not obscure required combat UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. VISUAL ACCEPTANCE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A. SPAWN

Expected:
- Stormbreaker immediately feels red-tier
- both fighters visibly move slower
- multiple floor pulses occur
- weapon itself has linked head/handle electricity
- not just random sparks

B. PICKUP

Expected:
- global slow ends
- brief claim energy
- no stale floor aura

C. THROW

Expected:
- very fast rotation
- slight rotational smear
- smooth motion
- short local electricity around the whole weapon
- NO LONG TAIL
- no centerline chasing effect
- no blue ribbon
- no frame-rate collapse

D. IMPACT

Expected:
- hit point flashes brightly
- weapon disappears through flash
- target is stunned
- large arena discharge
- camera kick feels strong
- victim gets residual crackle

E. MISS

Expected:
- no fake hit flash/stun
- weapon lifecycle resolves cleanly

F. SUSTAINED PLAY

Expected:
- no accumulating hidden modifiers
- no runaway VFX object count
- no progressive slowdown

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. FAILURE CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAIL if:

- long lightning tail exists during throw
- a blue ribbon follows Stormbreaker
- one fixed center-point beam chases behind it
- throw frame rate visibly drops
- slow persists after pickup
- both fighters are not slowed while unclaimed
- weapon electricity is only random detached sparks instead of linked across the weapon
- Stormbreaker remains visibly embedded/stationary after impact
- hit flash is not localized to impact
- target is not actually stunned
- arena discharge becomes unreadable full-screen noise
- weapon asset identity is replaced
- unrelated accepted APEX behavior regresses

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. REGRESSION SAFETY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Protect all accepted current systems.

Before broad changes, inspect the current handoff.

Do not regress:
- existing fighter movement
- weapon aiming
- current weapon roster
- current spawn logic
- asset rendering
- audio/SFX
- damage numbers
- blood VFX
- skills
- UI/UX
- mobile behavior
- performance work
- arena/chamber visuals

Stormbreaker should be an isolated additive weapon integration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before claiming completion:

1. Run existing tests.
2. Build/run the game.
3. Test actual Stormbreaker spawn.
4. Verify global slow on both fighters.
5. Verify slow cleanup on pickup.
6. Verify linked weapon crackle.
7. Verify throw animation at multiple trajectories.
8. Verify NO long tail.
9. Verify real frame pacing during throw.
10. Verify confirmed-hit flash.
11. Verify weapon hides after hit flash.
12. Verify real stun.
13. Verify impact discharge.
14. Test miss path.
15. Test repeated Stormbreaker spawn/use cycles if possible.
16. Check console.
17. Inspect git diff for unrelated changes.
18. Commit intended files only.
19. Push only the authorized game branch.
20. Report final SHA.

Do not claim success from code inspection alone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. FINAL REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report:

A. starting branch + HEAD
B. final commit SHA
C. files changed
D. where red-tier rarity was integrated
E. where Stormbreaker spawn/pickup/attack state is defined
F. how global slow is applied and removed
G. how weapon anchors/local electricity are implemented
H. confirmation: NO LONG THROW TAIL
I. how throw performance was kept bounded
J. real damage / collision hook used
K. stun implementation
L. impact flash/discharge implementation
M. miss behavior
N. browser/runtime performance evidence
O. regression checks
P. any real remaining issue

Do not finish by proposing a new Stormbreaker visual redesign.

Implement the locked reference first.