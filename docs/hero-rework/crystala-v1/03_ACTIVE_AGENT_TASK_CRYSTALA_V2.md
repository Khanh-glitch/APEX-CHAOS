# ACTIVE AGENT TASK — CRYSTALA MINIMAL DELTA PATCH

Repository: Khanh-glitch/APEX-CHAOS
Target branch: arena/01a0ee80-apex-chaos

## Read first

Audit LIVE branch state, then read completely:

- docs/hero-rework/crystala-v1/02_CRYSTALA_V2_SIX_SHARD_RESOURCE_AUTHORITY.md
- docs/hero-rework/crystala-v1/00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md
- public/game/hero-rework/crystalGameplayRuntime.js
- public/game/hero-rework/heroRegistry.js
- public/game/hero-rework/crystalaGoldV6.js
- public/game/hero-rework/crystalaPresentationRuntime.js
- tools/testCrystalaGameplayGates.mjs

The 02 document is a MINIMAL-DELTA override. Do not treat it as permission to redesign CRYSTALA.

## Scope

Change ONLY:

### WALL
- Wall can be attempted without K when existing live HEXA path is not eligible.
- Wall always uses BLADE L/R, shard ids [0,1].
- Both must be ORBIT/free.
- Wall HP = 80.
- Successful J cooldown = 8.0 s.
- Breaking projectile (damage >= remaining Wall HP) breaks Wall and passes through with full current damage/provenance WITHOUT Wall reflection.

### K
- Remove omniscient would-hit/body prediction from shard acquisition.
- Eligible hostile projectile entering 450 px read radius can claim a free shard.
- Successful intercept target ring = 300 px from Crystal center.
- Remove inward rescue bands 180/150/120/90.
- Keep real swept moving-shard contact and Gold Hermite/facet/refraction/recoil grammar.
- Contact->visible dock total = 1.60 s.
- K cooldown = 12.0 s.
- K active duration remains 2.4 s.
- six independent shard slots remain exactly independent.

## Explicit NON-SCOPE

HEXA MUST REMAIN LIVE-CURRENT.

Do not change any HEXA:
- eligibility semantics/path;
- K relationship;
- six-free requirement;
- radius;
- facet count;
- facet HP (keep 75);
- build/closure;
- lifetime;
- reflection/break ordering;
- physical gap;
- visuals;
- T6;
- own-projectile law.

Also do not change Passive, other heroes, or current visual-performance optimizations.

Do not add:
- new Hexa mechanics;
- new two-facet escape laws;
- new point-blank K rules;
- new breakthrough-to-K immunity unless absolutely required by existing collision ordering to make the single breaking Wall projectile physically continue as specified;
- new HUD/resource systems;
- new statuses;
- new global recovery state.

## Engineering rule

Prefer local Crystal edits. Shared runtime edits are allowed only if same-frame Wall-break pass-through cannot be implemented locally; if unavoidable, keep them Crystal-specific and add a regression gate.

Do not fake K success by consuming a projectile at assignment. Real moving-shard collision remains mandatory.

## Mandatory tests

Implement the 24 acceptance gates in Authority §5, with special focus on:
- live HEXA behavior before/after patch is unchanged;
- K-off Wall [0,1];
- Blade busy fail/no cooldown;
- Wall HP 80;
- J CD 8;
- Wall breaking shot passes unreflected at full current damage;
- K read 450/contact 300;
- near-miss that enters radius can consume one shard;
- six independent K jobs still work;
- dock independence;
- 1.60 s return;
- K CD 12 / active 2.4;
- no old inward rescue bands;
- T6/Passive/Gold/performance regressions absent.

## Evidence before finish

Run:
- focused Crystala correctness gates;
- runtime revision/hash gate;
- production build;
- Crystala production-browser performance profile;
- Gold parity/readability checks;
- relevant Arsenal stabilization suite.

Performance must not materially regress from current cached-construct baseline. Do NOT reduce visual quality to recover performance.

## Finish

Then:
1. audit final diff against 02 line-by-line;
2. verify no accidental HEXA change;
3. verify no unrelated hero/shared-system edits;
4. bump runtime revision;
5. relock hashes;
6. leave target branch playtest-ready;
7. report exact HEAD, changed files, tests/profile, and any known pre-existing unrelated failures.

Do not stop at analysis; implement and prove the minimal patch.
