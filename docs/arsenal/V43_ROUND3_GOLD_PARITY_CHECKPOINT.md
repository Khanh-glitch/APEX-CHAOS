# V4.3 Round 3 — owner Gold parity and combat unification checkpoint

Date: 2026-10-10. Baseline: PR #24 Round 2 head `3073b3c`. Scope: Draft branch only, never production.

## Acceptance is NOT granted
The owner rejected V4.3 Round 2 VFX/motion after playtest. Do not substitute green CI/build output or scripted HP totals for visual acceptance. Do not merge or replace production.

## Concrete root-cause audit
- Existing Hero Rework replaces normal bullet update, but intentionally dispatches `aq_v43` to the Arsenal base simulation. Crystal's acquisition knew about these mobile special projectiles, but their movement path did **not** call Crystal's swept surface arbitration before native Fighter collision.
- Crystal re-own changes projectile owner/velocity, which disagrees with the boomerang immutable launch-to-return spline, and plasma shard auto-homing. Reflected boomerang must travel on the post-reflection physical vector; reflected plasma shard must not silently re-steer.
- Plasma charge is rendered inside the held-weapon draw pass; charge visual compositing, screen-edge clips and frame ordering need actual Chrome screenshots against the uploaded `APEX_CHAOS_ARSENAL_LAB_V4_3_NATURAL_FLIGHT_OFFLINE (1).html` reference.
- The previous VFX verification only established presence of procedural function names and isolated damage figures; the Gold asset/motion transfer needs per-phase comparison.

## Round 3 work applied
- Mobile V4.3 projectile movement invokes Crystal `resolveBullet(p, bodyT, dt)` **before** native Fighter damage. Boomerang path invokes it on each sampled leg, while other mobile special bodies use their swept segment. Non-reflectable status burn, flame contact and deployed mine remain outside this projectile arbitration.
- A reflected boomerang no longer gets repositioned to its former owner's spline; reflected plasma shards no longer follow their original target via auto-homing. Both respect Crystal's one-reflection provenance.
- New static regression checks were appended to `tools/testOwnerV43LifecycleInvariants.mjs`. Static assertions are not a replacement for simulation tests.

## Required next gates (all currently OPEN)
1. **Crystal motion evidence**: interception and return trajectory of each V4.3 mobile kind, K shard and J wall/HEXA; exact owner transfer and reflected damage once, including alternate hero effects. Test against legacy `aq_bullet` as a control.
2. **Plasma visual**: uncut charging core at full extent (especially close to canvas edges); all 4 compression rings and particles, projectile tails, charged release, three-way split, and distinct impact frames.
3. **Per-weapon Gold comparisons**: muzzle/throw origin, flight silhouette and scale, smoke, flame emissions, energy, impact, return/tumble, mine arming and burst. Compare animated clips or timestamped frames at equal zoom and settings; no subjective sign-off by CI.
4. **Visual/physics unified contract**: data-driven capabilities for linear/tracking/return/deploy/status projectiles, immutable spawn identity, owner changes and re-own policy, with renderer consuming gameplay events. Do not fork a second damage authority.
5. **Balance**: replay deterministic distances, accuracy/dodge, cooldown, burst and sustained output across all eight new weapons and conventional guns. Tune per-weapon configs only after counterplay rules and visuals are stable; verify Quest/BOT and Crystal/Magnet/Mirror regressions.
6. **Release**: node/Chrome CI, screenshots, genuinely new build artifact and independent preview ZIP provenance. Owner must inspect a separate Cloudflare preview and explicitly accept Gold visuals before promotion.

## Preserve invariants
- PR #24 stays Draft and unmerged. No production deploy.
- Keep all 41 owner weapon ID assignments (25–32 are V4.3).
- Keep pinned `20261010-q1-b8-native-runtime` Gold revision and version-bust only changed V4.3 URLs as required by the established Gold build chain.
- Keep previous successful Round 2 ZIP as an immutable rejected-for-visual-quality comparison reference.
