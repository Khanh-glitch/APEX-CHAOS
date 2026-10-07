# R59 Recovery D4 — Core Six BOT Tactical Audit

Authority baseline: `d0328808da80fbfad673ce32c757287490e7ef6f`  
Recovery branch: `arena/r59-recovery-d032880`

This audit is deliberately separate from implementation. It distinguishes
**mechanic legality** (`canCast`) from **BOT tactical utility**
(`aiEvaluate`). A cooldown becoming READY is never, by itself, permission to
cast.

## Robot — implemented candidate (D1-D3)

- A1 legality: an eligible revealed non-T6 pickup exists.
- BOT utility:
  - unarmed + eligible pickup -> strong SELECT;
  - already armed -> HOLD by default;
  - contested denial against a nearby unarmed rival -> SELECT;
  - no pickup -> REJECT without calling `tryCast`.
- A2 legality: player may activate whenever READY.
- BOT utility:
  - hostile projectile predicted to cross Robot's threat radius -> SELECT;
  - armed rival within authored combat range policy -> SELECT;
  - unarmed/no credible threat -> HOLD.
- Decision telemetry: `AICastConsider / Reject / Select / Outcome`.

Status: implemented on recovery branch; runtime/headless/browser execution still
requires verification.

## Magnet — policy is source-derivable, safe next implementation candidate

Current recovery behavior:
- A1/A2 only have mechanic `canCast`; BOT therefore treats READY as useful.
- `canCast` only prevents A1/A2 field overlap. It does not prove a target
  exists.

Source-grounded utility:
- A1 Attraction:
  - SELECT when at least one eligible revealed firearm exists. Floor attraction
    is arena-wide by the authored mechanic.
  - SELECT when a hostile/neutral eligible firearm projectile will cross the
    authored A1 bullet radius (480 at Lv1) during its 1.00 s active window.
  - otherwise HOLD.
- A2 Repel:
  - SELECT when an enemy body or eligible floor firearm is inside the authored
    radius (225 at Lv1).
  - SELECT when a hostile/neutral eligible firearm projectile will cross that
    radius during the authored 1.80 s active window.
  - otherwise HOLD.

Do not invent weapon-name allowlists beyond the existing Arsenal firearm/T6
authorities.

## Frost — policy is source-derivable, safe next implementation candidate

Current recovery behavior:
- A1 and A2 explicitly return `aiCanAttempt() === true`.
- Therefore a BOT spends both cooldowns on the normal post-ready timer even
  when the authored geometry contains no useful target.

Source-grounded utility:
- A1 Frost Breath:
  - use the live facing vector;
  - authored lane length = 650, full width = 310;
  - SELECT if a living enemy intersects that lane;
  - also SELECT if an eligible revealed firearm lies in that same lane because
    Frost floor is authoritative for Frozen Gun conversion;
  - otherwise HOLD.
- A2 Frost Hunt:
  - derive reachable envelope from live movement speed × authored 2.0 s active
    window + real body contact radii + half the authored 120-wide trail;
  - SELECT only if a living opponent is inside that reachable envelope;
  - otherwise HOLD.

Do not add a second AI-only Frost range constant.

## Mirror — split confidence

### A1 Arsenal — source-derivable
Current recovery behavior:
- Human `canCast` allows an intentional whiff and consumes cooldown.
- BOT currently inherits that behavior and can deliberately whiff.

BOT utility:
- SELECT only when opponent holds a copyable weapon.
- HOLD on unarmed, T6/Stormbreaker, SWIRL_SHIELD, or TOWER_SHIELD.
- Human whiff behavior must remain unchanged.

### A2 Exchange — do not implement from distance alone
Current mechanic:
- atomic position-only swap;
- HP, velocity, weapon and status remain owned by each fighter.

There is no current gameplay authority defining which of the two positions is
strategically better. A rule such as "cast whenever not touching" merely turns
READY into a slower reflex and is not tactical intelligence.

Before implementing BOT A2, define a position utility score from existing world
truth (for example hazard/floor-control/threat or objective value). Do not
invent a magic distance threshold just to make casts occur.

## Hunter — needs tactical policy, but avoid arbitrary distance tuning

Current recovery behavior:
- A1 only checks presentation idle + active-trap capacity.
- A2 checks presentation idle + that at least one living enemy exists.
- Neither is a tactical BOT decision.

A1 facts:
- trap is planted at Hunter's real cast origin;
- max 3 active; lifetime 6 s; root 1.25 s;
- cast includes authored slide/recoil.

A useful BOT policy must justify why the opponent is likely to contest/cross
that origin. Trap capacity alone is not utility.

A2 facts:
- movement speed 2200 for max 0.50 s (1100 raw travel before collision/world
  constraints);
- real physical contact is required;
- successful catch stuns 2.0 s, applies WEAK 1.0 s, and disarms an equipped
  ranged weapon.

High-confidence trigger: an armed rival in physically reachable path is valuable.
For an unarmed rival, source does not currently define a threshold for spending
the 12 s cooldown; avoid inventing one without a positional/threat score.

## Crystala — A1 has preflight, not utility; A2 is reflex

Current recovery behavior:
- A1 `aiCanAttemptConstruct` is exactly `canCastConstruct`.
- It proves HEXA/WALL can succeed mechanically; it does not prove the construct
  is useful now.
- A2 Awakening has no BOT policy, so READY is effectively permission.

A1 facts:
- HEXA requires live Awakening decision window + all six ORBIT shards and
  targets the real enemy anchor.
- WALL fallback requires BLADE L/R ORBIT and a living enemy anchor.
- Wall lifetime 4.0 s; HEXA/prison is an Awakening commitment.

A2 facts:
- Awakening lasts 2.4 s;
- scan radius 450 / intercept band 300;
- it opens the authored shard/intercept + HEXA decision context.

Safe policy work should be tied to existing projectile/intercept/construct
truth. Do not cast A2 solely because its 12 s cooldown is READY.

## Implementation order recommended after Robot verification

1. Magnet — all thresholds already exist in authored field geometry.
2. Frost — all thresholds already exist in authored lane/reach geometry.
3. Mirror A1 only — eligibility is explicit.
4. Hunter — only after a source-backed position/threat trigger is defined.
5. Crystala — only after shard/intercept/construct utility is expressed from
   existing Crystal truth.
6. Mirror A2 — last; requires a real positional utility authority.

Each hero remains one candidate SHA / one behavior family. Do not batch all
Core Six into one implementation commit.
