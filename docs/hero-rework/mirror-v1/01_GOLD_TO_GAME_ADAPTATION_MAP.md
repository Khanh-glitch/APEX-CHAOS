# MIRROR V1 — GOLD -> GAME ADAPTATION MAP

Verdicts:
- **EXACT** — reproduce Gold behavior/geometry/timing directly.
- **REAL-TRUTH ADAPTATION** — Gold choreography stays exact but demo stand-in is replaced by actual APEX object/actor truth.
- **APEX BALANCE RETAINED** — Gold does not model the production law.
- **REPLACE CURRENT** — current implementation conflicts with approved Gold-first behavior.

| Subsystem | Gold 12 | Current snapshot `df3f9fb` | Production target | Verdict |
|---|---|---|---|---|
| Main actor art/material | full split-face Gold shell | generic rework fighter shell | Gold renderer owns MIRROR body | REPLACE CURRENT / EXACT |
| Temporal history | HN64/HS22, authored delays/wrong identity | no final Mirror presentation engine | direct Gold state/history | EXACT |
| Native movement | demo SPD250 etc. | APEX movement | keep APEX root; feed post-movement truth into Gold | APEX BALANCE RETAINED |
| A1 cast target | opponent held weapon | snapshot at cast | same | EXACT semantic |
| A1 real copy timing | OWN at u=.58 | immediate `grantWeaponCopy()` | materialize on Gold OWN edge | REPLACE CURRENT |
| A1 copy lifetime | 6s after OWN | 6s after immediate equip | 6s from OWN | REPLACE CURRENT |
| A1 visual weapon | demo generic weapon image | no Gold peel | actual captured weapon identity through Gold reflect/peel transforms | REAL-TRUTH ADAPTATION |
| A1 whiff | authored whiff motion | cooldown-consumed semantic exists | preserve both | EXACT + retained balance |
| A2 snap | after Gold movement at .25 | scheduler callback pre-movement in current wrapper timing | post-movement exact snap | REPLACE TIMING SEAM |
| A2 positions | live current coordinates with no observable half-state | callback snapshots current coordinates, but generic transaction writes+emits one move at a time | batch-write both final positions before any observer event | REPLACE ATOMICITY SEAM |
| A2 history | `shiftHist()` + stale/wrong residue | no final Gold history | exact Gold rebase | EXACT |
| Shard count | demo power accumulator | round(realized/35), min>=20,max5 | keep current balance formula | APEX BALANCE RETAINED |
| Shard age | >.7 before formation | instant formation attempt on spawn | >.7 | REPLACE CURRENT |
| Formation scan | .3s | only called on spawn | .3s | REPLACE CURRENT |
| Formation topology | seed + 4 nearest, 4th <170 | seed cluster <=130 | Gold topology/radius | REPLACE CURRENT |
| Formation ownership | one Mirror in demo | all world shards can mix | same-owner only | production instance adaptation |
| Assembly | staggered physical alignment -> fill -> active | instant shard deletion/node spawn | exact Gold state machine | REPLACE CURRENT |
| Node geometry | oriented sliver polygon + surface | circular radius44 portal | Gold geometry + shared transform | REPLACE CURRENT |
| Node cap | effective 3, old node folds when new forms | global 3, rejects new | 3 per owner, fold oldest | REPLACE CURRENT |
| Node lifetime | 10s ACTIVE then fold | 10s from spawn | 10s from ACTIVE | REPLACE CURRENT |
| Entry preview | d<34 to surface | none | Gold surface preview | EXACT |
| Capture | d<17 to surface | circle-radius instant | swept surface capture | REPLACE CURRENT |
| Routing destination | nearest other node | nearest other global mirror | nearest other ACTIVE same-owner node | Gold-instance adaptation |
| Transit | image -> escrow -> dest image -> emerge .56s | instant teleport | Gold transit | REPLACE CURRENT |
| Exit controller | neutral | neutral | neutral | RETAIN |
| Projectile payload | preserved | mostly preserved | preserve all real semantic metadata | RETAIN/HARDEN |
| Anti-loop | .45 post-exit | skip `lastPortalId` indefinitely for same portal | .45 recapture lock, valid later chain allowed | REPLACE CURRENT |
| Object-family coverage | Gold generic detached projectile | bullets + grenades only | all eligible detached projectile families incl normal thrown melee | COMPLETE CANONICAL LAW |
| Free shard lifetime | no natural expiry demo | 6s | 6s until reservation | APEX BALANCE RETAINED |
| Generic circle renderer | none | shared debug circle shard/mirror art | suppress MIRROR generic draw when Gold owns it | REPLACE CURRENT |

## A1 visual transaction

Production must not make the real holder exist before the visible image becomes real.

Canonical causal chain:

`CAST SNAPSHOT -> NOTICE -> LOCK -> REFLECT -> PEEL -> REFORM -> OWN event -> real equip -> 6 s lifetime`

At OWN, use the real Arsenal equip path so firing/reload/ammo/damage remain canonical. The Gold renderer must stop being the weapon owner after the real holder exists; otherwise the gun will double-render.

## A2 causal seam

Gold order is character/opponent movement -> A2 step -> history push. Current generic delayed scheduler ticks pre-movement. Mirror implementation must therefore create a post-movement Mirror seam rather than accepting an almost-correct 0.25-second timer at the wrong frame phase.

The exact swap must use a transactional two-position snapshot. The existing AIL transaction is not a safe-relocation solver despite old comments, and its current `commit()` writes+emits each move sequentially; synchronous listeners can therefore observe a half-swapped intermediate state. MIRROR must batch-write both positions before emitting relocation/snap events (Mirror-local or a safely corrected shared primitive). MIRROR does not need a safe-corner resolver because both destinations were occupied legal positions immediately before the swap.

## Passive real-object bridge

Do not fake projectiles for the mirror network. The actual projectile object is escrowed and later reinserted/released with all relevant semantic tags. Preserve:
- weapon/family/class;
- damage/critical;
- owner provenance/generation lineage;
- CHILL/FROST/replay/RUBBER/other semantic payloads;
- grenade remaining fuse;
- thrown-melee flight/grace/maxFlight state;
- direction/speed.

Only controller/hit policy changes to the approved neutral output law.

## Render ownership

MIRROR final presentation should own:
- actor body;
- false reflections/history;
- A1 temporary reflected/peeling image;
- A2 local reflection ghosts;
- passive shard/node art and image-memory/ripple effects.

Existing engine remains owner of:
- actual equipped weapon after A1 OWN;
- blood/damage popups unless a narrowly scoped incompatibility is proven;
- arena/fighters other than the MIRROR actor;
- actual projectile object outside escrow.

Every Gold draw pass must save/restore transform, alpha, composite, filter, shadow, clip/path and smoothing state where changed.
