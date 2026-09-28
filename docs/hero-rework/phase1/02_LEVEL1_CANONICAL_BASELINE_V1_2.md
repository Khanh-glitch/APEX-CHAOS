# APEX CHAOS — HERO LEVEL 1 CANONICAL BASELINE v1.2
Status: PHASE-1 FROZEN LEVEL-1 AUTHORITY

This is the gameplay starting point for the 12-Hero Rework. Final live balance is not proven; real-engine telemetry and owner playtest remain required.

## Global laws

- Canonical roster: ROBOT, CRYSTAL, MAGNET, BLACK_HOLE, MATH_V2, ICE, RUBBER, HUNTER, TIME, MIRROR, SLIME, SNIPER.
- ROBOT is the product-facing replacement for legacy NEWBIE.
- Hero abilities create situations/control/geometry/timing/protection/chaos; Arsenal weapons remain the combat protagonist.
- T6/Stormbreaker is immune to Hero object manipulation; physical pickup/collision/damage remain legal; holder is not globally CC immune.
- New Hero mechanics use AIL v2 event/damage/status/targeting/relocation/storage semantics.
- Visual direction is deferred; geometry/mechanics below are gameplay authority, not final art direction.

---

# 1. ROBOT

## A1 — Weapon Dash
- cooldown: 10s
- dash speed: 3400
- max dash time: 0.55s
- turn rate: 11 rad/s
- physically moves ROBOT toward nearest eligible revealed pickup
- no teleport/ownership transfer
- T6 is not an auto-target
- physical walk-over pickup remains legal

Do not preserve the old hidden soft-magnet acquisition as a new semantic requirement unless needed only as a legacy fallback; rework intent is physical dash/pickup.

## A2 — Virtual Armor
- cooldown: 10s
- duration: 3.0s
- damage reduction: 55%
- effective incoming damage multiplier: 0.45
- no separate CC immunity

## Passive — Damage-Dealt Milestone Refund
Use the existing visible cumulative damage-dealt milestone ladder already present in game.
- milestone #1: no refund
- milestone #2: 0.5s
- milestone #3: 1.0s
- milestone #4: 1.5s
- subsequent milestones: +0.5s each relative to previous
- one proc per milestone
- listens to credited realized damage dealt
- refunds remaining cooldown of the currently relevant/equipped Active

Do not invent new milestone thresholds; inspect the existing visible ladder.

---

# 2. CRYSTAL

## A1 — Crystal Wall
- cooldown: 11s
- wall HP: 120
- lifetime: 4s
- target width: ~220px
- real physical/destructible geometry

## A2 — Crystal Prison
- cooldown: 20s
- 6 walls
- 75 HP per wall
- cage radius: 135
- max lifetime: 3s
- no invisible root; confinement comes from real geometry

## Passive — Refraction
- reflected damage: 50%
- reflection changes current controller to CRYSTAL
- original provenance retained
- payload/status survives unless explicitly stripped
- multi-reflection allowed when physically valid
- only same-surface zero-progress loop suppression
- T6 cannot be Hero-reflected/manipulated

---

# 3. MAGNET

## A1 — Magnetic Acquisition
- cooldown: 10s
- pull acceleration: 1500
- max pulled weapon speed: 1000
- max active time: 2s
- physical pull; opponent can intercept
- T6 immune

## A2 — Repulsion Field
- cooldown: 13s
- duration: 2.2s
- radius: 210
- fighter push acceleration: 1300
- eligible projectile radial impulse: 900
- not invulnerability
- T6 unaffected

## Passive — Magnetic Acceleration
- owned projectile/thrown velocity: +18%
- no raw damage increase
- T6 unaffected

---

# 4. BLACK_HOLE

## A1 — Singularity Transit
- cooldown: 14s
- active duration: 2.7s
- capacity: 8 stored objects
- transit delay: 0.35s
- exit should be safe/readable, target ~120px away from a fighter where relevant
- preserve object identity/payload/provenance
- preserve velocity/momentum through release
- controller/hitPolicy remain unchanged
- T6 immune to storage/manipulation

## A2 — Damage Singularity
- cooldown: 18s
- absorb/escrow window: 1.0s
- stored-damage cap: 300
- return: 65% of eligible stored damage in one return event
- post-return vulnerability: 3s
- vulnerability incoming multiplier: x2
- T6 damage is not captured/escrowed by Hero object manipulation rules

## Passive — Growing Event Horizon
- +1 radius per 10 realized HP damage actually suffered
- Level-1 max growth: +100 radius
- growth changes body/visual footprint and pickup footprint
- healing does not reduce growth
- escrowed damage that never realizes as HP loss does not count
- larger body is also a downside because it is easier to hit

---

# 5. MATH_V2

Old Division/Rotation kit is deprecated.

## A1 — Parabola Graph
- cooldown: 10s
- graph is real Oxy/parabola world geometry
- absorbs/blocks spatial damage sources that physically intersect it
- not global immunity
- ends when its Level-1 lifecycle completes or MATH picks offensive Arsenal equipment
- heal pickup does not end it
- exact parabola equation/scale/orientation is a tuning slot, not fake precision

Progression normalization:
- max graph lifetime is separated from cooldown so higher levels cannot shorten the graph
- Level-1 max lifetime target: 10s
- recast replaces existing graph; no stacking

## A2 — Damage Equation / Virtual Armor
- cooldown: 20s
- MATH counter starts at 0 and tracks MATH credited realized damage dealt
- opponent counter starts at 0 and tracks opponent credited realized damage dealt
- neutral damage adds to neither
- opposing physical body collision cashes out the equation
- Virtual Armor HP = MathCounter + OpponentCounter
- armor duration: 3s
- if the equation expires/resets before cashout, counters reset
- no Level-1 armor cap before real-engine evidence

## Passive — Multiply / Divide
- Graph ending produces x2 gate at arena center for 2s
- Virtual Armor ending produces /2 gate at arena center for 2s
- x2: eligible MATH projectile becomes 2 projectiles, each 100% normal damage at Level 1
- /2: eligible opponent projectile visual size and damage become 1/2
- same-surface immediate loop suppression only
- T6 unaffected
- duplicate separation angle is a tuning slot

---

# 6. ICE

Canonical CHILL is one common status:
- movement slow: 30%
- duration: 2.5s after latest valid Chill application
- A1 and A2 use the same CHILL
- reapplication refreshes duration
- intensity does not stack
- shorter application never shortens longer active Chill
- T6 object manipulation unaffected

## A1 — Ice Bullets
- cooldown: 11s
- Active duration: 4s
- eligible owned shots apply CHILL

## A2 — Ice Lane
- cooldown: 10s
- windup: 0.25s
- lane width: 120
- speed: 1800
- traverses arena
- direct damage: 0
- applies CHILL
- no homing

## Passive — Deep Freeze
- continuous CHILL threshold: 3.0s
- Freeze duration: 1.1s
- after Freeze, continuous-Chill accumulation resets
- no automatic loop
- one isolated 2.5s Chill application cannot auto-Freeze

---

# 7. RUBBER

## A1 — Elastic Kinetic State
- cooldown: 12s
- active accumulation window: 4s
- energy cap: 100
- maximum movement-speed bonus: +55%
- post-active energy decay: 25/s
- opponent collision stun threshold: 60 energy
- collision stun: 0.55s
- energy is derived from actual collision impulse; old arbitrary glancing/normal/strong buckets are deprecated
- exact impulse->energy calibration is a tuning slot

## A2 — Projectile Compression
- cooldown: 15s
- duration: 2.5s
- capacity: 8 eligible projectiles
- movement speed loss: 7% per stored projectile
- minimum movement-speed floor: 45%
- release: outward/radial according to release policy
- released projectile keeps 100% original damage
- if released projectile hits opponent, corresponding debt is erased
- miss/despawn returns 100% original damage debt to RUBBER
- T6 immune

## Passive — Afterbounce
- duration: 2.2s
- opponent push impulse: 650
- RUBBER loses 15% current speed while preserving direction
- can re-proc only after separation/new contact
- no Passive stun

---

# 8. HUNTER

Owner explicitly rejected buffing solely from V0 proxy results.

## A1 — Snare Trap
- cooldown: 11s
- trap lifetime: 8s
- max active traps: 1
- root: 1.6s
- placed at current HUNTER position
- bullets/pickups/VFX do not trigger it

## A2 — Pounce + Weak
- cooldown: 12s
- windup: 0.18s
- movement speed: 1500
- max movement time: 0.45s
- direct damage: 0
- valid body hit applies Weak for 3s
- Weak increases incoming damage by 25%
- Pounce can miss

## Passive — Killer Instinct
When target is Trapped or Weak:
- genuine eligible incoming projectile on collision course gets 28% dodge chance
- physical dodge distance: 95
- anti-chain lockout: 0.45s
- no invulnerability
- T6 excluded from Hero manipulation/evasion logic where capability says so

---

# 9. TIME

No balance buff from V0 proxy; intended high skill ceiling.

## A1 — Time Loop
- cooldown: 18s
- record window: 2s
- replay: 2 loops x 2s
- live timeline never rewinds
- ghost bodies are intangible
- no new AI, pickup, Hero Active, recursion or current-target recomputation
- gameplay replay whitelist:
  - bullet
  - burst/auto detached emissions
  - shotgun pellet fan
  - grenade throw
  - normal thrown melee
- no gameplay replay:
  - direct melee swing
  - shield
  - persistent field
  - Hero Active
  - replay-generated temporal event
  - T6 (visual ghost only later if desired)

## A2 — Rewind
- cooldown: 16s
- snapshot delay: 3s
- restore own HP/position/velocity if still alive
- do not rewind opponent/world/projectiles/inventory/ammo/cooldowns
- no revive
- damage already dealt remains

## Passive — Timeline Markers
- information-only
- faint positions 1s and 2s ago at Level 1
- opponent corresponding markers may be lighter if presentation later chooses
- no gameplay mutation

---

# 10. MIRROR

## A1 — Mirror Arsenal
- cooldown: 15s
- copy lifetime: 6s
- copy opponent's currently held eligible weapon
- fresh same-weapon instance
- fresh normal ammo/use state
- opponent keeps original
- if opponent unarmed/ineligible, cast may whiff
- T6 cannot be copied
- Level-1 shield copy remains excluded

## A2 — Mirror Exchange
- cooldown: 12s
- telegraph: 0.25s
- atomic position swap only
- each Combatant keeps own velocity/HP/weapon/status
- use RelocationTransaction

## Passive — Shattered Mirrors
Realized damage generates shards under inherited Level-1 values:
- approximately 1 shard per 35 realized damage
- minimum one on event >=20
- max 5 shards per event
- shard lifetime: 6s
- 5 shards within 130 radius form a mirror
- mirror lifetime: 10s
- max 3 mirrors

Portal behavior:
- route to a valid other mirror according to current Level-1 routing policy
- exiting projectile controller = NEUTRAL
- damage unchanged
- may hit either side
- no Hero gameplay damage credit/milestone/passive progress
- provenance retained
- T6 immune
- technical zero-progress anti-loop only

---

# 11. SLIME

One Combatant, multiple Bodies. Distributed per-body HP. Total living HP conserved across split/transfer/heal. Healing cannot exceed legal Combatant max-HP budget.

## A1 — Mitosis
- cooldown: 14s
- split duration: 6s
- split into 2 Bodies
- current HP divided evenly
- no HP duplication
- body-size formula should conserve physical area; exact rendering radius may be implemented from conserved-area formula
- initial divergence target: +/-25
- existing weapon stays with one Body; other begins unarmed and may physically acquire equipment
- on merge, surviving HP sums; no heal/duplication
- equipment merge must be deterministic and cannot duplicate equipment

## A2 — Damage Shedding
- cooldown: 16s
- Active duration: 5s
- every 100 realized damage -> temporary child
- carry-over damage progress: yes
- max simultaneous A2 children: 3
- child HP: 140, transferred from SLIME health rather than created free
- child lifetime: 5s
- child radius target: 45
- child speed: 90% normal
- child is a valid enemy auto-target
- child may physically pick/use weapons under normal equipment rules
- child weapon damage uses normal weapon semantics at Level 1
- on normal expiry, surviving child HP returns to nearest valid surviving SLIME Body
- killed child HP is lost
- timed expiry may not delete the last living SLIME's still-valid HP; preserve Combatant correctness

## Passive — Emergency Mitosis
For each Body:
- trigger when that Body has lost 80% of its own reference/max HP (20% remains)
- split current HP equally into two
- each resulting Body must receive at least 100 HP
- if either would receive <100, do not split
- successful split replaces source; no HP duplication
- new Body reference HP derives from its creation state so recursion naturally self-limits
- example: 1000 -> 200 -> 100 + 100
- Combatant dies only when no living Body remains

---

# 12. SNIPER

## A1 — Farthest Corner / AimLost
- cooldown: 14s
- relocate to farthest of 4 legal corners
- corner inset: 110
- opponent loses normal auto-aim for 2.2s
- opponent may still fire using last aim behavior
- T6 Stormbreaker homing/targeting is unaffected

## A2 — Sniper Nest
- cooldown: 12s
- max duration: 4s
- movement speed: 0 while active
- predictive intercept uses current projectile speed before firing
- post-muzzle projectile is normal; no homing/curve added
- spread multiplier: x0.25
- fixed 4s duration after weapon consumption is a playtest watchpoint, not auto-changed

## Passive — Distance Crit
Distance breakpoints:
- <=250: +0%
- 500: +8%
- 750: +16%
- >=1000: +24%
- additive crit chance
- total crit chance cap: 55%
- crit damage unchanged

---

# Cross-system Level-1 laws

## Damage / credit
- follows current gameplay controller, not historical origin
- CRYSTAL reflected damage credits CRYSTAL
- BLACK_HOLE transit preserves controller
- MIRROR-neutral credits neither Hero
- ROBOT milestones use credited realized damage
- BLACK_HOLE growth uses actual HP loss only

## Relocation
- MIRROR swap atomic
- SNIPER and TIME use safe relocation resolver
- no skipped-path contacts
- destination overlap normal

## Projectile transforms
- CRYSTAL reflect
- BLACK_HOLE store/release
- RUBBER store/release
- MATH duplicate/divide
- MIRROR portal/neutralize
- ICE status payload survives unless explicitly stripped
- T6 bypasses Hero manipulation

## Time
- replay semantic detached emissions only
- replay lineage cannot recursively replay itself

## Slime
- logical victory/HUD/save = Combatant
- movement/contact CC may apply to contacted Body unless effect explicitly targets Combatant
- HUNTER Weak after valid Pounce may be Combatant-level according to mechanic authority

# Explicit unresolved/tuning slots — not design blockers

- MATH parabola exact equation/scale/orientation
- MATH xN duplicate separation angle
- RUBBER impulse->energy calibration
- purely visual dimensions/timing
- deterministic AI BAD/NORMAL/GOOD cast thresholds
- final Lv2-Lv5 numeric balance curves
