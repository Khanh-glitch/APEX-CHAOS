# APEX CHAOS — AIL v2 CANONICAL
Status: DESIGN-LOCKED SYSTEM FOUNDATION

AIL is a semantic protocol/adaptation layer over the current engine. It is NOT an ECS rewrite and NOT a wholesale engine replacement.

## 1. Identity model

### COMBATANT
Logical P1/P2 match identity. Owns Hero identity, team, match HP/maxHP authority, ability/cooldown state, logical statuses, victory/HUD/stats/save identity.

### BODY
Physical manifestation. Owns x/y/velocity/radius/collision/movement/targetability/equipment carrying/local physical state.
Normal Hero: 1 Combatant -> 1 Body.
SLIME: 1 Combatant -> multiple Bodies.
TIME ghosts are not Combatants.

### ENTITY + traits/capabilities
World objects may carry several semantic traits/capabilities. Do not force everything into one exclusive type enum.

## 2. Semantic event language

Canonical flow:

`AbilityIntent -> AbilityCast -> AttackEvent -> EmissionEvent -> world/contact -> ContactEvent -> HitAttempt -> DamageEvent -> RealizedDamageEvent -> post-event`

AttackEvent and EmissionEvent are distinct.
Example: one shotgun trigger = one AttackEvent, several pellet EmissionEvents.

Required listeners:
- TIME records semantic EmissionEvents, not AI decisions.
- MIRROR shards listen to RealizedDamageEvent.
- ROBOT milestones use cumulative credited RealizedDamageEvent.
- BLACK_HOLE growth uses actual HP loss, not attempted/escrowed damage.

## 3. TargetingPolicy

Target selection is first-class.
Default: opponent Combatant's eligible Body.
Required support:
- normal opponent Body,
- SNIPER predictive aim,
- AimLost,
- SLIME multiple targetable Bodies,
- SLIME A2 child as valid enemy auto-aim target,
- T6/Stormbreaker equipment targeting independent from normal Hero auto-aim suppression.

## 4. Swept TOI transform law

For relevant high-speed/spatial transforms:
1. previous -> proposed segment,
2. query swept contacts,
3. earliest time-of-impact,
4. resolve,
5. transform state if required,
6. continue remaining segment.

Use where needed for reflection/portal/storage/high-speed Hero geometry.
Avoid tunneling and P1/P2 update-order bias.

## 5. No global transform caps

Do not invent one-reflection, one-portal, one-transform-per-frame rules.
Allow valid multi-wall/multi-portal chains.
Only technical guards:
- same-surface immediate recontact epsilon,
- bounded zero-progress failsafe.

Guards must not suppress valid later/multi-surface interactions.

## 6. Ownership / controller / hitPolicy / provenance

Separate:
- `originSource`: original source,
- `controller`: current gameplay allegiance/credit,
- `hitPolicy`: who may currently be hit,
- compact provenance/generation for debug and invariants.

Examples:
- CRYSTAL reflect: original provenance retained, controller becomes CRYSTAL.
- MIRROR portal: controller becomes NEUTRAL; may hit either; no Hero gameplay damage credit/milestone/passive progress; provenance retained.
- BLACK_HOLE transit: controller/ownership/hitPolicy unchanged unless explicit future authority says otherwise.
- ICE payload survives transforms unless explicitly stripped.

Production provenance stays compact; full transform history is debug/test-only.

## 7. Damage pipeline

New Hero systems must not use ad hoc raw HP mutation as their normal path.

Canonical broad order:
1. raw attack damage,
2. offensive modifiers / crit,
3. target vulnerability (e.g. HUNTER Weak),
4. defender mitigation (e.g. ROBOT Virtual Armor),
5. interception/replacement/escrow (e.g. eligible BLACK_HOLE A2),
6. HP realization,
7. RealizedDamageEvent,
8. post triggers.

T6 nuance: object manipulation immunity is not global defender immunity. ROBOT may mitigate damage received because ROBOT modifies the defender; BLACK_HOLE cannot capture/manipulate T6 attack where capability says no.

## 8. StatusResolver

Shared representation, status-specific stack/refresh semantics. Do not solve every status with one universal max-duration rule.

ICE canonical CHILL:
- 30% movement slow,
- 2.5s duration after latest valid application,
- A1 and A2 use same status,
- repeated valid application refreshes duration,
- intensity does not stack,
- shorter application never shortens a longer current Chill,
- Deep Freeze Lv1 threshold 3.0s continuous Chill,
- Freeze 1.1s.

## 9. Capability-based manipulation

Hero systems ask capabilities, not Hero/weapon-name checks.

Representative verbs:
FORCE, REDIRECT, STORE_ENTITY, PORTAL, DUPLICATE, MODIFY_PAYLOAD, MODIFY_STATUS_PAYLOAD, DESTROY.

T6/Stormbreaker:
- physical pickup allowed,
- physical collision allowed,
- damage allowed,
- Hero object manipulation denied as specified,
- holder is NOT globally CC immune.

Use this authority consistently for ROBOT, MAGNET, CRYSTAL, BLACK_HOLE, RUBBER, MATH, MIRROR, ICE and future manipulation systems.

## 10. Relocation

Single-actor relocation: SNIPER corner and TIME Rewind use shared safe resolver.
Relocation does not simulate skipped-path contacts.
Destination overlap/contact resolves normally after arrival; landing on HUNTER trap may trigger it.

MIRROR swap uses atomic RelocationTransaction:
1. snapshot sources,
2. compute destinations from snapshot,
3. batch validate,
4. deterministic geometry conflict resolution,
5. simultaneous commit,
6. arrival contacts afterward.

## 11. Storage / release primitive

BLACK_HOLE and RUBBER share semantic Store/Release with different policies.
Stored entity retains semantic identity/provenance/payload/controller/hitPolicy unless skill says otherwise.
Stored entity has no normal world collision.
Release behavior is skill-specific.
Grenade fuse while stored is not guessed globally; explicit policy required.

## 12. SLIME multi-body architecture

Do not turn SLIME children into new logical P1/P2 Combatants.
SLIME = one Combatant owning `bodies[]`.

Bodies may be targetable/collidable/equipment carriers/individually damaged.
Level 1 health model = distributed per-body HP with total HP conservation through split/transfer/heal.

Hard invariants:
- body death != Combatant death,
- Combatant loses only when no living Body remains,
- HUD/win/save identity remains Combatant,
- child is valid enemy auto-aim target.

## 13. Pickup / equipment service

Expose shared pickup actor concept such as `getPickupActors(combatant)`.
Normal Hero -> primary Body.
SLIME -> eligible Bodies.
ROBOT/MAGNET use the same equipment eligibility authority.
T6 capability rules remain centralized.

## 14. AbilityController

Reworked Actives do NOT extend `arsenalManualSkillGate`.

Input:
`Activate(slot) -> AbilityIntent -> AbilityController -> validation -> AbilityCast -> mechanic`.

AbilityController owns cooldown/availability/cast lifecycle/mode exposure.
Legacy gate may remain only for quarantined legacy routes during migration.

## 15. Clocks and lifecycle

Clock domains:
- SIM_TIME: movement/projectiles/collision/status/Time recording,
- ABILITY_TIME: cooldown/ability policy,
- REAL_TIME: UI/presentation only.

No raw `setTimeout` for gameplay semantics.
Use lifecycle-bound MatchScheduler/event queue.

Every gameplay state/entity has explicit lifecycle owner/end condition: MATCH, COMBATANT, BODY, ABILITY_CAST, EQUIPMENT, FIXED_DURATION as appropriate.

## 16. Deterministic RNG

New Rework systems use match-seeded deterministic RNG.
Failures must be reproducible from seed/state.
Do not require rewriting every legacy Math.random before Hero Rework can ship; adapt incrementally.

## 17. Debug / telemetry

Debug/trace must be able to answer:
- what is this entity/event,
- who created it,
- who controls it now,
- who may it hit,
- payload/status,
- generation / recent transform,
- why damage realized.

Production keeps compact provenance; full history opt-in.

## 18. Required testing

Use primitive tests, invariant tests, cross-skill golden scenarios, deterministic fuzz/property tests, and owner playtest.

Mandatory invariants:
- legal relocation destinations,
- atomic swap independent of P1/P2 update order,
- valid projectile controller/hitPolicy,
- neutral projectile can hit either but gives no Hero gameplay credit,
- temporal recursion bounded,
- stored entities resolve lifecycle,
- T6 not Hero-manipulated,
- DamageEvent realizes once,
- SLIME HP never duplicates,
- SLIME body death does not end match,
- TIME never replays replay-generated TIME event,
- match teardown leaves no Hero gameplay callbacks/entities,
- epsilon guards prevent zero-progress loops without suppressing valid chains.

Mandatory golden scenarios:
- CRYSTAL reflect x ICE,
- MIRROR neutral x ICE,
- BLACK_HOLE storage of reflected projectile,
- RUBBER storage of reflected projectile,
- TIME replay x MIRROR portal,
- MATH geometry/relocation x HUNTER trap,
- SLIME body x SNIPER targeting,
- T6 x every manipulation-capable Hero.

## 19. Owner-locked defaults

### MIRROR neutral
After portal: controller NEUTRAL; may hit either Combatant; no Hero gameplay damage credit/milestone/passive progress; provenance retained.

### SLIME A2 targetability
Child is a valid enemy auto-aim target, owned by SLIME Combatant, not a third Combatant.

### MIRROR A1 copy
Fresh same eligible weapon instance; fresh normal ammo/use state; opponent keeps original; T6 cannot copy.

### TIME replay whitelist
Gameplay replay includes detached emissions:
- bullet,
- burst/auto emissions,
- shotgun fan,
- grenade throw,
- normal thrown melee.

No gameplay replay of:
- direct melee swing,
- shield,
- persistent field,
- Hero Active,
- replay-generated temporal event,
- T6 (visual ghost only if desired later).

## 20. Migration guardrails

- preserve stable legacy behavior while adapters are introduced,
- no full FighterTypes/projectiles rewrite prerequisite,
- no new Hero-specific raw takeDamage branches when AIL can express it,
- no raw gameplay timers,
- no expansion of legacy manual gate,
- architecture must not force boring Hero design,
- owner playtest remains required; CI is not visual/feel acceptance.
