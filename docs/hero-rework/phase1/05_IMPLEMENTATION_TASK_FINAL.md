# APEX CHAOS — HERO REWORK IMPLEMENTATION TASK — FINAL ONE-SHOT AUTHORITY
## 2026-09-27

You are the implementation Agent for `Khanh-glitch/APEX-CHAOS`.

This is one autonomous implementation campaign. Do not stop after internal checkpoints to ask the owner whether to continue. Checkpoint commits are crash-recovery points, not approval gates.

---

# 1. FIRST ACTION — LIVE PRE-FLIGHT

Before editing:

1. Fetch remote.
2. Verify you are working only on:
   `arena/01a0e086-apex-chaos`
3. Record:
   - local HEAD,
   - remote tip,
   - `git status --short`,
   - local vs remote divergence,
   - any unpushed work.
4. Preserve local work before any reset/clean/checkout.
5. Read every Phase-1 authority completely.
6. Re-audit the live dependency graph before deleting/moving legacy roster code.
7. Run current baseline suites before implementation changes.

Task preparation state:
- branch tip when prepared: `8ca566b378c48cfb6b81ec17711a7c8e6e16d139` (evidence-only)
- latest gameplay/runtime code beneath it: `2a93825f3208c0ed27c866abcbb25720858fd671`
- latest verified workflow before task prep: Arsenal Quest Stabilization run `36324468260`, success on `9ffb419d01b18705056cae277c6a60650518a78b`

These may already be stale. Fetch first.

Rollback branch created before this campaign:
`safety/pre-hero-rework-implementation-20260927`

Do not move that safety branch casually.

---

# 2. REQUIRED AUTHORITIES — READ IN ORDER

Under `docs/hero-rework/phase1/`:

1. `00_READ_FIRST.md`
2. `01_AIL_V2_CANONICAL.md`
3. `02_LEVEL1_CANONICAL_BASELINE_V1_2.md`
4. `03_HERO_DEFINITION_CONTRACT_V1_FINAL.md`
5. `04_PHASE1_FINAL_FREEZE_AND_ROSTER_CUTOVER.md`
6. this task

Also re-read:
- project zero-context handoff,
- VIBECODE `SKILL.md` / current equivalent operating authority.

Historical/V0 files are evidence only when they conflict with these Phase-1 authorities.

---

# 3. MISSION

Implement the canonical 12-Hero Rework on top of the stable Arsenal/Quest product while preserving the accepted Arsenal weapon game and CP7 stability.

Canonical product roster:

```text
ROBOT
CRYSTAL
MAGNET
BLACK_HOLE
MATH_V2
ICE
RUBBER
HUNTER
TIME
MIRROR
SLIME
SNIPER
```

The campaign must:

- implement the minimum viable AIL v2 semantic foundation using adapters over the current engine,
- implement the owner-approved Hero Definition Contract,
- implement all 36 Level-1 Hero skill mechanics,
- move production Arsenal Quest from the legacy 33-shell roster to the canonical 12,
- prevent legacy target-Hero native kits from double-running,
- quarantine non-target Heroes from the new product path,
- reduce legacy roster runtime dependency from Quest where dependency audit proves it safe,
- preserve stable Arsenal/Stormbreaker/blood systems,
- extend the existing real headless/browser harness with deterministic Hero-Rework evidence,
- leave the branch pushed, recoverable and playtestable.

Do NOT invent final Hero visual direction, silhouettes, final VFX style, final icons/cards, animation language or audio identity. The owner is designing those separately.

Temporary implementation presentation must be neutral/debug-readable and explicitly non-final.

---

# 4. DESIGN NON-NEGOTIABLES

Hero mechanics should create readable physical 2D arena moments.

Arsenal/weapons remain the combat protagonist.

Prefer:
- timing,
- geometry,
- trajectory,
- visible state,
- physical consequence,
- good/bad cast timing.

Avoid:
- fake MOBA complexity,
- generic stack/consume/empower systems,
- hidden meters unless explicitly approved,
- Hero abilities becoming the primary raw damage engine,
- adding complexity to rescue weak implementation ideas.

Preserve blood/splatter.

---

# 5. AIL v2 IMPLEMENTATION SCOPE

AIL is an adapter/protocol layer, not an ECS rewrite.

Implement only the shared primitives required by the canonical 12.

## Identity
- Combatant = logical P1/P2 identity.
- Body = physical manifestation.
- Entity = world object carrying semantic traits/capabilities.

Normal Hero: one Combatant / one Body.
SLIME: one Combatant / multiple Bodies.

## Semantic events

```text
AbilityIntent
-> AbilityCast
-> AttackEvent
-> EmissionEvent
-> ContactEvent
-> HitAttempt
-> DamageEvent
-> RealizedDamageEvent
-> post-event
```

Keep AttackEvent distinct from EmissionEvent.

Required listeners:
- TIME records semantic detached emissions.
- MIRROR shards listen to RealizedDamage.
- ROBOT milestones listen to credited realized damage dealt.
- BLACK_HOLE growth listens to actual HP loss.

## TargetingPolicy
Must support:
- normal opponent Body,
- SNIPER predictive pre-shot targeting,
- AimLost,
- SLIME multi-body targets,
- T6/Stormbreaker equipment targeting independent from normal Hero targeting effects.

## Swept interaction / TOI
Use previous->proposed segment, earliest contact, resolve, continue remaining segment where high-speed/transform mechanics need it.

Do not add arbitrary global transform caps.

Only technical same-surface/zero-progress guards are allowed.

## Provenance
Separate:
- originSource,
- controller,
- hitPolicy,
- compact provenance/generation.

## Damage pipeline
Shared pipeline supports offense/crit -> vulnerability -> defense -> interception/escrow -> HP realization -> post events.

Do not add new ad hoc Hero-specific raw `takeDamage()` branches when shared modifiers/interceptors can express the mechanic.

## StatusResolver
Common representation with status-specific semantics.

ICE canonical CHILL:
- 30% slow,
- 2.5s duration,
- A1/A2 same status,
- refresh duration,
- no intensity stacking,
- Deep Freeze Lv1 threshold 3.0s,
- Freeze 1.1s.

## Capability authority / T6
T6:
- physical pickup legal,
- physical collision legal,
- damage legal,
- Hero object manipulation denied as specified,
- holder NOT globally CC immune.

Do not scatter Stormbreaker name checks across Hero mechanics.

## Relocation
Shared safe resolver.
MIRROR swap = atomic RelocationTransaction.
No skipped-path contacts; arrival overlaps resolve normally.

## Store/Release
Shared semantic primitive for BLACK_HOLE and RUBBER with skill-specific policy.

## SLIME
One Combatant owning multiple Bodies.
Children are not logical extra players.

## AbilityController
All reworked Active input:
`Activate(slot) -> AbilityIntent -> AbilityController -> mechanic`

Do not extend `arsenalManualSkillGate`.

## Clocks/lifecycle/RNG
- SIM_TIME gameplay
- ABILITY_TIME cooldown
- REAL_TIME presentation only
- no raw gameplay `setTimeout`
- lifecycle-bound scheduler
- deterministic match-seeded RNG for Rework systems

---

# 6. HERO REGISTRY / DEFINITION CONTRACT

Implement exactly 12 canonical HeroDefinitions and the 36 stable mechanic IDs in the final contract.

Hard rules:
- static definitions immutable,
- runtime state separate,
- exactly A1/A2/PASSIVE,
- stable IDs,
- NEWBIE -> ROBOT migration,
- one Hero-level AI decision authority,
- Body/Targeting/Mode policies referenced rather than duplicated,
- presentation uses semantic events only.

## Progression
A1, A2 and Passive levels are independent, Lv1-Lv5.

Every skill has exactly ONE progression knob.

For this campaign:
- implement progression plumbing/resolver,
- Level 1 is production truth,
- exact higher-level balance numbers are not to be invented when no approved curve exists,
- if structural tests require Lv2-Lv5, use clearly labeled non-production fixtures,
- automated validation must prove only the approved knob field changes.

---

# 7. IMPLEMENT ALL 36 LEVEL-1 MECHANICS

Use `02_LEVEL1_CANONICAL_BASELINE_V1_2.md` exactly. Do not redesign.

## ROBOT
- physical Weapon Dash
- Virtual Armor
- damage-dealt milestone cooldown refund
- product replacement for NEWBIE

## CRYSTAL
- real destructible wall geometry
- six-wall Prison
- reflection changes controller to CRYSTAL while retaining provenance/payload

## MAGNET
- physical eligible weapon pull
- opponent can intercept
- repulsion field is not invulnerability
- projectile/thrown speed Passive

## BLACK_HOLE
- two-singularity object transit
- damage escrow/return/vulnerability
- body/pickup footprint grows from realized HP loss

## MATH_V2
- Parabola Graph real world geometry
- two credited-damage counters -> Virtual Armor on physical collision
- Graph end -> multiply gate
- Armor end -> divide gate

## ICE
- common CHILL status
- Ice Bullets
- Ice Lane
- Deep Freeze

## RUBBER
- collision-impulse-derived energy, not old fake collision buckets
- Projectile Compression + damage debt
- Afterbounce

## HUNTER
- physical Snare Trap
- missable Pounce + Weak
- conditional physical dodge

## TIME
- detached semantic emission record/replay
- Rewind own HP/position/velocity snapshot only
- information-only Timeline Markers
- no temporal recursion

## MIRROR
- fresh eligible opponent weapon copy; opponent keeps original
- atomic position swap
- damage -> shards -> mirrors
- portal output becomes NEUTRAL

Neutral projectile:
- may hit either side
- no Hero gameplay damage credit/milestone/passive progress
- provenance retained

## SLIME
- distributed per-body HP
- total HP conserved
- no HP/equipment duplication
- A2 child HP transferred, not created
- child valid enemy auto-target
- body death != Combatant death
- Combatant dies only when no Body remains

## SNIPER
- farthest-corner relocation + AimLost against normal targeting
- stationary predictive pre-shot Nest
- normal post-muzzle projectile
- distance crit modifier/cap from Level-1 authority

---

# 8. LEGACY ROSTER MIGRATION — CRITICAL

Current repo is patch-heavy. Do NOT perform a blind delete-first cleanup.

At preparation:
- Arsenal shell path exposed legacy 32 + NEWBIE = 33.
- classic character select hardcoded 9 old Heroes.
- Quest loaded `BATTLE_CORE_RUNTIMES` including legacy `ROSTER_RUNTIMES`.
- 11 canonical target names already existed as legacy Hero implementations.
- ROBOT replaces NEWBIE.

Therefore the main risk is legacy/new **double execution**.

## Required roster states

### ACTIVE_PRODUCT
Only canonical 12.

### LEGACY_QUARANTINED
May remain for rollback/dev/old routes, but:
- not selectable in new Quest,
- not in production random pools,
- not in progression/unlock choices,
- not in new-product AI roster,
- not loaded by new Quest once dependency audit proves unnecessary.

### DELETED
Only after reference graph + tests prove dead and no retained route/save dependency remains.

Quarantine before physical deletion.

---

# 9. DO NOT MAKE LEGACY FIGHTERTYPES THE NEW AUTHORITY

Unsafe:

```text
legacy CRYSTAL update
+ shell delegation
+ new registry mechanic
= hidden double execution
```

Required:

```text
legacy FighterTypes = quarantine/compat/history
canonical Hero Registry = product authority
typed mechanics + AIL = reworked gameplay
```

For the 11 target IDs already present in legacy engine, the rework path must not also delegate old:
- init
- update
- onCollide
- onTakeDamage
- Hero-specific projectile spawning
- Rage branches

unless an explicitly audited neutral helper is intentionally reused.

---

# 10. ROBOT CUTOVER

At product cutover:
- UI/product ID = ROBOT
- registry = ROBOT
- mechanic IDs = `robot.*`
- legacy NEWBIE save/ID resolves to ROBOT
- old `makeNewbieType()` loses product authority
- old NEWBIE manual-gate special becomes legacy-only

Never show ROBOT and NEWBIE together.

---

# 11. CHECKPOINT CAMPAIGN

Do not ask owner to continue between these unless a real stop condition occurs.

## CP-HR0 — Preflight
- live Git audit
- baseline suites
- dependency map
- current roster/Quest loading map

## CP-HR1 — AIL + Registry
- shared architecture
- 12 HeroDefinitions
- 36 skill IDs
- AbilityController
- progression resolver
- NEWBIE->ROBOT migration
- no production roster cutover yet

Gates:
- registry integrity
- static/runtime isolation
- one-knob validator
- Level-1 equality framework

## CP-HR2 — Straightforward single-body mechanics
Suggested first group where useful:
ROBOT, ICE, HUNTER, SNIPER, MAGNET.

Do not hard-code architecture around this subset.

## CP-HR3 — Geometry/transform/storage
CRYSTAL, BLACK_HOLE, RUBBER, MATH_V2.

## CP-HR4 — Complex semantic/lifecycle
TIME, MIRROR, SLIME.

## CP-HR5 — Cross-Hero hardening
Golden scenarios + deterministic fuzz/invariants.

## CP-HR6 — Quest roster cutover
Production Arsenal Quest roster becomes canonical 12.
Retired Hero IDs cannot spawn/select through production Quest.
No legacy target-kit double execution.

## CP-HR7 — Legacy runtime quarantine/load cleanup
Audit before removing anything from Quest load groups.

Goal:
Quest should no longer load old Hero runtimes merely for retired roster behavior.

Measure before/after:
- menu responsiveness
- Quest readiness
- long tasks
- request/script evaluation work

Do not reduce combat VFX quality.

## CP-HR8 — Final verification
- full suites
- real-browser evidence
- final branch pushed
- report legacy code: active/quarantined/deleted/retained dependency

---

# 12. REAL TEST REQUIREMENTS

Extend the existing real harness. Do not replace with a toy simulator.

Use deterministic seeds.

## Registry
- exactly 12 product Heroes
- 36 unique skill IDs
- one progression knob per skill
- Level-1 equality

## Golden scenarios
At minimum:
- CRYSTAL reflect x ICE payload
- MIRROR neutral portal x ICE
- BLACK_HOLE storage of reflected projectile
- RUBBER storage of reflected projectile
- TIME replay x MIRROR portal
- MATH geometry/relocation x HUNTER trap
- SLIME Body x SNIPER targeting
- T6 x every manipulation-capable Hero

## Invariants
- no SLIME HP duplication
- no equipment duplication
- body death != SLIME Combatant death
- no MIRROR neutral credit leakage
- no TIME recursive replay
- no relocation order bias
- no T6 Hero manipulation
- DamageEvent realizes once
- stored entities resolve lifecycle
- match teardown leaves no Rework gameplay callbacks/entities
- same-surface guard prevents zero-progress loops without blocking valid chains
- no legacy target-kit double execution

## Fuzz dimensions
- Hero pair
- weapon family
- skill casts
- reflect/portal/store chains
- seed

Failure record must include deterministic seed + semantic trace.

---

# 13. TELEMETRY REQUIRED FOR LATER BALANCE

Do not claim final balance from CI.

Required high-risk telemetry:

### MATH
- generated projectile count
- peak entities
- added realized damage
- frame/entity pressure

### SLIME
- living Body count
- HP sum vs legal budget
- equipment ownership count
- child create/death/expiry

### ROBOT
- milestone refunds
- Active uptime

### CRYSTAL
- wall survival
- reflected realized damage
- prison survival/escape

### BLACK_HOLE
- stored object count
- stored/returned damage
- final radius
- pickup/hit behavior at larger radius

### HUNTER
- dodge attempts/triggers
- Weak added realized damage

### SNIPER
- distance crit realization
- Nest hit-rate by weapon family

### TIME/MIRROR
- temporal/portal generation and realized value

---

# 14. TEMPORARY PRESENTATION RULES

Owner is designing visual direction in parallel.

Allowed:
- simple geometry
- neutral outlines
- labels
- restrained debug colors
- state/contact indicators needed to verify gameplay

Forbidden:
- inventing final Hero silhouettes
- choosing permanent palette/art language
- designing final VFX identity
- generating final icons/cards
- calling placeholders final
- deriving gameplay hitboxes from temporary sprite sizes

Final report must explicitly mark temporary presentation as non-final.

---

# 15. STABLE SYSTEMS TO PROTECT

Do not regress accepted Arsenal base:

- Stormbreaker damage: 446
- hit stun: 2.0s
- speed: 1350
- spin: 82 rad/s
- ricochets: 1
- homing cap: 2.6 rad/s
- maxFlight: 2.2s
- floor lightning: 1.0s stun / 0 damage
- T6 Hero-manipulation immunity
- physical T6 pickup allowed
- holder not globally CC immune
- blood/splatter behavior
- CP7 readiness/audio/menu fixes

Hero Rework integrates with these; do not rewrite them casually.

---

# 16. LEGACY SURFACES REQUIRING EXTRA CAUTION

Audit before migration/cleanup:

- `public/game/arsenal/arsenalShellSelectRuntime.js`
- `public/game/arsenal/arsenalManualSkillGate.js`
- `public/game/core/apexFullRosterQa.js`
- `public/game/core/apexRosterExtensions.js`
- `public/game/core/apexCanonicalBalance.js`
- `public/game/core/apexPrecisionFixes.js`
- `public/game/ui/apexCharacterSelectUi.js`
- `src/game/runtimeManifest.js`
- `public/apexEngine.js`

Some chain-wrap functions or contain shared fixes. Filename alone is not proof of safe deletion.

---

# 17. STOP CONDITIONS

Continue autonomously unless:

1. live Git contains newer owner-approved authority that materially conflicts with this task,
2. required shared engine change would break stable Arsenal weapon behavior and no adapter path is viable,
3. a legacy patch is load-bearing for non-Hero core behavior and safe isolation requires a broader redesign,
4. gameplay genuinely depends on unresolved owner visual direction rather than temporary presentation,
5. authority contradiction changes Hero gameplay intent and precedence cannot resolve it.

If a stop condition occurs:
- preserve work,
- commit/push safe checkpoint if appropriate,
- report exact blocker with code evidence,
- do not invent a product decision.

---

# 18. FINAL REPORT CONTRACT

Report separately:

## Implemented
Actual code landed.

## Test-proven
Deterministic/headless/browser gates passed.

## Not owner-accepted yet
- temporary visual presentation
- final balance
- visual/feel quality

## Legacy status
For major old roster surfaces:
- active product
- quarantined
- physically deleted
- retained because of proven shared dependency

## Git
- final implementation SHA
- evidence/report SHA(s)
- remote tip
- CI run ID/conclusion

## Reproduction
Commands/routes for owner playtest.

Never equate tests with owner acceptance.

---

# 19. FINAL CHECKSUM

HARD:
- only `arena/01a0e086-apex-chaos`
- canonical 12 product Heroes
- ROBOT replaces NEWBIE
- all 36 Level-1 mechanics from authority
- one progression knob per skill
- AIL adapter layer, not ECS rewrite
- AbilityController for new Actives
- no legacy target-kit double execution
- no raw gameplay timers
- seeded Rework RNG
- T6 capability authority preserved
- SLIME one Combatant / multiple Bodies
- MIRROR neutral semantics preserved
- TIME no recursive replay
- final visual direction deferred
- old roster quarantined before deletion
- blood/splatter preserved
- real harness + deterministic evidence

SOFT:
- exact file/folder organization
- helper naming
- refactor shape where behavior/authority remains identical

Do not ask for continuation between internal checkpoints. Execute the campaign to completion unless a real stop condition occurs.
