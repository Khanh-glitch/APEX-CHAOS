# APEX CHAOS — P1.5 HERO DEFINITION CONTRACT v1 FINAL
Status: OWNER-APPROVED / DESIGN-LOCKED

## Core role

`HeroDefinition` is the identity/data authority above AIL v2.

It answers:
- Hero ID,
- A1/A2/Passive identity,
- typed mechanic executor,
- Level-1 config,
- exactly one progression knob,
- body/targeting/AI/mode references,
- stable save/UI/telemetry/presentation IDs.

It is NOT:
- ECS,
- an engine rewrite,
- generic JSON ability scripting,
- the physics implementation,
- final VFX/art/audio authority,
- live match state.

## Runtime authority

After implementation there is one canonical Hero Registry for the reworked product path.
Gameplay, UI, AI, save, telemetry and tests reference that registry; gameplay values are not duplicated across modules.

## Static definition vs runtime state

Static definition is immutable in a match.
Runtime state is per Combatant/per match.

Runtime-only examples:
- skill level snapshot,
- cooldown remaining,
- cast phase,
- ROBOT milestones,
- MATH counters,
- TIME recording,
- MIRROR shards/mirrors,
- SLIME Body IDs,
- BLACK_HOLE current radius.

Never mutate HeroDefinition to hold match state.

## Stable Hero IDs

`ROBOT, CRYSTAL, MAGNET, BLACK_HOLE, MATH_V2, ICE, RUBBER, HUNTER, TIME, MIRROR, SLIME, SNIPER`

Legacy migration:
`NEWBIE -> ROBOT`

Do not expose both as product Heroes.

## Skill slots

Every Hero has exactly:
- A1
- A2
- PASSIVE

No Phase-1 A3/Ultimate/Trait2.

## Conceptual HeroDefinition

```ts
interface HeroDefinition {
  schemaVersion: number;
  definitionVersion: number;

  id: HeroId;
  display: {
    nameKey: string;
    shortDescriptionKey: string;
  };

  bodyProfileRef: string;
  baseTargetingPolicyRef: string;

  skills: {
    A1: SkillDefinition;
    A2: SkillDefinition;
    PASSIVE: SkillDefinition;
  };

  aiPolicyRef: string;
  presentationProfileRef: string;
  assetManifestRef: string;
  telemetryNamespace: string;
}
```

`schemaVersion` = shared format version.
`definitionVersion` = semantic/save compatibility version.

## SkillDefinition

```ts
interface SkillDefinition {
  id: string;
  slot: 'A1' | 'A2' | 'PASSIVE';
  kind: 'ACTIVE' | 'PASSIVE';

  mechanicId: string;
  baseConfig: Readonly<unknown>;
  progressionBinding: ProgressionBinding;

  activationPolicy?: ActivationPolicy;
  lifecyclePolicyRef: string;

  presentationEventNamespace: string;
  telemetrySkillId: string;
}
```

`baseConfig` must be typed/discriminated by `mechanicId`.
Do not create one universal damage/radius/stacks/duration blob.

## Stable mechanic IDs

| Hero | A1 | A2 | Passive |
|---|---|---|---|
| ROBOT | `robot.weapon_dash` | `robot.virtual_armor` | `robot.damage_milestones` |
| CRYSTAL | `crystal.wall` | `crystal.prison` | `crystal.refraction` |
| MAGNET | `magnet.acquisition` | `magnet.repulsion_field` | `magnet.acceleration` |
| BLACK_HOLE | `black_hole.transit` | `black_hole.damage_singularity` | `black_hole.event_horizon` |
| MATH_V2 | `math.parabola_graph` | `math.damage_equation` | `math.multiply_divide` |
| ICE | `ice.bullets` | `ice.lane` | `ice.deep_freeze` |
| RUBBER | `rubber.elastic_state` | `rubber.compression` | `rubber.afterbounce` |
| HUNTER | `hunter.snare` | `hunter.pounce_weak` | `hunter.killer_instinct` |
| TIME | `time.loop` | `time.rewind` | `time.timeline_markers` |
| MIRROR | `mirror.arsenal` | `mirror.exchange` | `mirror.shattered_mirrors` |
| SLIME | `slime.mitosis` | `slime.damage_shedding` | `slime.emergency_mitosis` |
| SNIPER | `sniper.farthest_corner` | `sniper.nest` | `sniper.distance_crit` |

## Mechanic executor boundary

HeroDefinition selects/configures mechanics; mechanic executors own behavior.

Examples:
- `crystal.wall` creates destructible geometry,
- `time.loop` records/replays eligible semantic emissions,
- `slime.damage_shedding` creates temporary Bodies while preserving HP invariants.

Do not build a generic node/script interpreter.

## One-knob progression law

```ts
interface ProgressionBinding {
  minLevel: 1;
  maxLevel: 5;
  knobPath: string;
  curveId: string;
}
```

Exactly one knob per skill.

Hard validation:
- resolve Lv1..Lv5,
- diff effective configs,
- changed fields must be a subset of exactly the approved `knobPath`.

If a second gameplay field changes because of level, fail the test.

Level-1 invariant:
`resolved Lv1 == canonical Level-1 baseline` for all 36 skills.

## Independent skill levels

```ts
interface HeroSkillLevels {
  A1: 1 | 2 | 3 | 4 | 5;
  A2: 1 | 2 | 3 | 4 | 5;
  PASSIVE: 1 | 2 | 3 | 4 | 5;
}
```

No required aggregate gameplay Hero level.

## AbilityController

All reworked Active activation:

`Player/AI -> Activate(slot) -> AbilityIntent -> AbilityController -> validation -> AbilityCast -> mechanic`

AbilityController owns:
- availability,
- cooldown,
- cast eligibility,
- mode exposure,
- rejection reason,
- Active cast lifecycle.

Mechanic owns what a valid cast does.

Do not extend `arsenalManualSkillGate` for the reworked 12.

Passive internal anti-chain/anti-loop/re-contact locks are mechanic runtime state, not Active cooldowns.

## Lifecycle

A skill may spawn different states/entities with different owners, so SkillDefinition points to `lifecyclePolicyRef`.

Spawned state may bind to:
MATCH, COMBATANT, BODY, ABILITY_CAST, EQUIPMENT, FIXED_DURATION.

No raw gameplay `setTimeout`; use deterministic simulation scheduling.

## BodyProfile

Normal Heroes: `SINGLE_BODY`.
SLIME: `MULTI_BODY_COMBATANT`.

BodyProfile describes semantic topology/pickup/targetability, not all SLIME mechanics.

BLACK_HOLE remains single-body with runtime-mutating physical radius.

## TargetingPolicy

HeroDefinition owns `baseTargetingPolicyRef`.
Skills may install contextual overrides through typed mechanics.

Examples:
- SNIPER Nest predictive pre-shot target,
- SNIPER A1 AimLost against normal targeting,
- SLIME multiple targetable Bodies,
- Stormbreaker equipment targeting independent from normal auto-aim suppression.

## Mode exposure

Mode policy is separate from HeroDefinition.

```ts
interface HeroAbilityExposure {
  enabledActiveSlots: readonly ('A1' | 'A2')[];
  passiveEnabled: boolean;
  selectionMode: 'PREMATCH_ONE_ACTIVE' | 'BOTH_ACTIVE' | 'FIXED';
}
```

Same mechanic implementation across modes.

## AI

Only one Hero-level `aiPolicyRef` is decision authority.
Mechanics may expose eligibility/candidate/value facts; AI decides whether to cast and emits AbilityIntent through the same AbilityController as player.

BAD/NORMAL/GOOD are deterministic test profiles, not stats or save data.

## Presentation boundary

P1.5 defines semantic events only, e.g.
- `hero.crystal.wall.spawn`
- `hero.crystal.wall.break`
- `hero.crystal.reflect`
- `hero.time.loop.record_start`
- `hero.time.loop.replay_start`
- `hero.slime.body.split`

Later visual phase decides assets/VFX/sound/anchors/scale/art direction.

Gameplay cannot depend on a presentation listener existing.
Sprite size cannot silently become collision authority.

## Save contract

```ts
interface SavedHeroProgression {
  heroId: HeroId;
  definitionVersion: number;
  skillLevels: {
    A1: 1 | 2 | 3 | 4 | 5;
    A2: 1 | 2 | 3 | 4 | 5;
    PASSIVE: 1 | 2 | 3 | 4 | 5;
  };
  preferredActiveSlot?: 'A1' | 'A2';
}
```

Do not save transient match state unless resume-mid-match is explicitly designed.

Migration uses stable IDs/version, never localized display name.

## Telemetry

Base events:
- `hero_skill_intent`
- `hero_skill_cast`
- `hero_skill_fail`
- `hero_skill_end`
- `hero_skill_value`

Common dimensions:
matchSeed, combatantId, heroId, skillId, slot, skillLevel, simTime, success/failReason.

Telemetry must measure actual value from the one selected progression knob.

Mandatory correctness telemetry:
- SLIME HP/equipment conservation,
- TIME temporal generation,
- MIRROR origin/controller/hitPolicy/portal generation,
- MATH entity/projectile growth.

## Debug inspector

Must expose enough to inspect:
Hero ID/version/levels; skill ID/mechanic/effective knob/cooldown/runtime phase; Combatant->Body IDs/HP/targetability/equipment-carrier state; entity origin/controller/hitPolicy/payload/generation/last transform.

## Validation gates

Fail if:
- Hero count != 12,
- duplicate Hero ID,
- missing A1/A2/PASSIVE,
- duplicate skill ID,
- unknown mechanicId,
- missing progression binding,
- >1 progression knob,
- max level != 5,
- Lv1 differs from canonical baseline,
- V0 simulator proxy appears in production config,
- ad hoc HeroDefinition T6 override appears,
- static definition leaks match state,
- random Rework mechanic bypasses seeded AIL RNG.

## Hard prohibitions

Do not:
- ECS rewrite,
- generic arbitrary JSON ability interpreter,
- one giant `switch(heroId)`,
- scatter Hero-specific T6 checks,
- duplicate gameplay numbers into UI/AI/tests,
- mutate static definitions,
- use raw gameplay timers,
- let AI bypass AbilityController,
- derive hitboxes from temporary sprites,
- embed final art/VFX into HeroDefinition,
- use V0 simulator probabilities as gameplay stats,
- change more than one progression field per skill level.

Central owner-approved invariant:

> Lv1->Lv5 resolution for a skill may change exactly the one approved progression knob and nothing else.
