# ACTIVE AGENT TASK — IMPLEMENT CRYSTALA V2 SIX-SHARD RESOURCE MODEL

You are implementing a high-risk gameplay/state rewrite in APEX CHAOS.

Repository: Khanh-glitch/APEX-CHAOS
Target branch: arena/01a0ee80-apex-chaos

## FIRST: establish truth

1. Treat every Arena chat/local workspace as potentially stale.
2. Fetch/audit the LIVE target branch before editing.
3. Read completely:
   - docs/hero-rework/crystala-v1/02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY.md
   - docs/hero-rework/crystala-v1/00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md
   - public/game/hero-rework/crystalGameplayRuntime.js
   - public/game/hero-rework/crystalaGoldV6.js
   - public/game/hero-rework/heroRegistry.js
   - public/game/hero-rework/crystalaPresentationRuntime.js
   - tools/testCrystalaGameplayGates.mjs
   - tools/analyzeCrystalaDecisionTradeoffs.mjs
   - tools/profileCrystalaPerformance.mjs
4. Where V1 authority conflicts with 02_CRYSTALA_V2..., the V2 document is authoritative.
5. Audit the current performance work before changing presentation. Preserve construct raster cache, Gold visual fidelity, and no-quality-cut bloom optimizations.

## IMPLEMENT THE V2 AUTHORITY END-TO-END

This is not a tuning-only task. The required behavioral rewrite is fully specified in:
docs/hero-rework/crystala-v1/02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY.md

Critical frozen highlights:
- Fighter radius is 75; K successful contact ring = 300 px center radius.
- K = reactive 600 px guardian perimeter, not omniscient would-hit predictor.
- K CD 12.0 s, active 2.4 s, contact->dock 1.60 s.
- Six shards remain independent physical slots.
- J CD 8.0 s.
- J does NOT universally require K.
- K active + all 6 exactly ORBIT/free -> HEXA.
- Otherwise J attempts WALL with fixed Blade ids 0 and 1 only.
- Wall: 220 width, 80 total HP, 4.0 s max solid.
- Wall breaking projectile does NOT reflect; it passes with full current damage/provenance and must not be immediately rescued by K.
- Hexa: K active + all six free only; radius 135; 6 facets; 60 HP/facet; ~0.75 s Gold closure; 3.0 s solid.
- Hexa breaking facet shot IS reflected first, then facet opens.
- Remove the temporary V1 decisionWindow=1.2 / maxCastsPerAwakening=1 architecture.
- Preserve Passive 50%, max-one-Crystal-reflection, T6 immunity.

## ENGINEERING CONSTRAINTS

### Preserve Gold
Do not redesign Crystal visuals. Continue using the approved Gold:
- Hermite shard travel
- facet orientation
- internal-light refraction
- recoil
- return/dock
- Wall/Prison construction and material
- current production caches/performance optimizations

Timing/path retiming required by V2 is allowed. Visual language replacement is not.

### Locality
Prefer implementing in Crystal-specific runtime/registry/tests.
Do NOT casually alter Robot/Hunter/Black Hole/Magnet/Mirror or shared engine semantics.
If a shared runtime edit is genuinely required for same-frame Wall breakthrough, keep it minimal, Crystal-tagged, deterministic, and add an explicit regression gate.

### No fake success
Do not satisfy K by deleting/consuming a projectile at reservation time.
A successful K block requires real swept moving-shard/projectile contact.

Do not hide a Wall breaker by marking it consumed.
The breaker must survive the Wall transaction and continue.

### Determinism
Shotgun pellets and simultaneous bullets must remain independent projectiles.
Stable ordering is required.
No frame-order roulette.

## TEST-FIRST REQUIREMENT

Before declaring success, add/modify deterministic gates that directly prove every item in Authority §11.

Especially prove:
1. K-off J -> Wall with shardIds exactly [0,1].
2. Blade busy -> Wall fail/no cooldown.
3. K-on six free -> Hexa.
4. K-on one shard busy -> NOT Hexa; Wall only if both Blades are free.
5. A near-miss/grazing hostile projectile entering 600 still consumes a guardian shard even though old body-hit predictor would have ignored it.
6. A projectile first appearing <=300 is a point-blank breach and is not magically rescued.
7. Six simultaneous perimeter entries use six distinct shards; seventh waits.
8. Successful K contact occurs around 300 px, never inward rescue bands.
9. realistic SNIPER path is blocked when eligible.
10. contact-to-dock is ~1.60 s.
11. Wall 80 HP + SNIPER: Wall dies, shot is not reflected, shot continues with full current damage, K does not rescue that same breakthrough shot.
12. spray sequence: early bullets reflect, breaking bullet passes, post-break bullets pass.
13. Hexa 60 HP facet + high-caliber shot: shot reflects, facet dies, physical gap opens.
14. T6 unchanged.
15. own/reflected projectile anti-loop laws unchanged.

## PRODUCTION EVIDENCE

Run:
- focused CRYSTALA correctness gates
- runtime revision/hash gate
- production build
- CRYSTALA production-browser profile
- decision-tradeoff probe updated for the V2 choices
- Gold parity/readability checks
- relevant Arsenal stabilization tests

Update decision analysis scenarios to represent the actual V2:
- Wall-only, K off
- K-only versus precision
- K-only versus rapid/spray
- K -> immediate Hexa
- Wall active -> K with only remaining free shards
- breakthrough high-caliber Wall case

Do not retain old WALL_EARLY/WALL_DELAYED timing conclusions as authority after the architecture is removed.

## PERFORMANCE GUARD

Do not regress the current no-quality-cut performance work.
Profile at least:
- dormant Crystal
- K with six shards
- K under six simultaneous guardian jobs
- Wall
- K while Wall shards are unavailable
- Hexa
- Hexa facet break

If the new gameplay logic is cheap but draw remains the bottleneck, report it honestly rather than degrading visuals.

## FINISHING / REPO HYGIENE

After implementation:
1. re-read the V2 authority and audit code against it line-by-line;
2. inspect git diff for unrelated edits;
3. update V1 authority only where necessary to clearly state V2 supersession—do not leave contradictory live docs;
4. bump runtime revision;
5. relock SHA256 runtime hashes;
6. ensure live target branch contains the finished commits;
7. report exact final HEAD SHA;
8. report all changed files;
9. report pass/fail counts and any known unrelated pre-existing CI failures;
10. summarize the final state machine and the measured matchup/tradeoff evidence.

Do not stop at an analysis report. Implement, test, audit, and leave the branch playtest-ready.
