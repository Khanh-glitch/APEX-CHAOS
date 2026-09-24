# APEX CHAOS // OWNER PLAYTEST REVISION 2 — SCALE, EXIT, AUDIO, MELEE, SHOTGUN & QUEST V1

**Date:** 2026-09-25  
**Status:** OWNER FEEDBACK FROZEN — IMPLEMENTATION AUTHORIZED AFTER KICKOFF  
**Arena baseline:** `d38c210ce6b492fb7c6746c4a19d87c52d29277a`  
**Playtest baseline remains frozen at:** `d38c210ce6b492fb7c6746c4a19d87c52d29277a`

This is a post-owner-playtest revision. Preserve the accepted POST-C weapon registry, rarity tiers, shield counter architecture, J/manual-skill gate, 3.0s spawn cadence, Newbie, 30-item offensive rarity pool, final SFX sources, VFX sanitation, 132/132 headless and 79/79 browser behavior unless this document explicitly supersedes a presentation/mechanics detail.

## 1. Gun scale — ONE family scale, preserve relative source proportions

Owner feedback: guns currently read as if they were normalized to one similar size. Large guns must visibly be large and compact guns must visibly be compact.

### Current defect

`tools/buildArsenalCAssets.mjs` currently supplies a separate hand-authored `longSide` for every Senko gun. Runtime floor draw also forces most revealed weapons to `targetLongSide: 118`.

This destroys the relative scale language of the source family.

Representative intrinsic Senko SVG widths audited from the current source set:

- Colt: 87.8245 source units
- Glock 17: 131.26174
- P90: 179.4707
- Sawed-off: 151.08554
- Project MBR: 350.66311
- AK-47: 380.69798
- M249 SAW: 520.10453
- Snipex Alligator: 764.16592

### New scale law

For all Senko-v9 guns:

1. extract and persist the source SVG intrinsic width/height/viewBox into generated metadata;
2. define exactly ONE tunable family constant, e.g. `SENKO_WORLD_SCALE`;
3. compute gun world dimensions from source intrinsic dimensions × that ONE constant;
4. do not keep per-gun visual `longSide` overrides for normal Senko guns;
5. tune only the global constant in browser until the family is readable;
6. floor hover, equipped weapon, muzzle/casing anchor transform, and post-use detached weapon must all consume the same resulting world scale;
7. Z15 skins share exactly the base Z15 scale;
8. no tier-based scale changes.

If a source file is objectively corrupt/empty, document the exception. Do not silently normalize every other weapon to accommodate one bad source.

Melee, grenade and shields are separate authored families and do not inherit the Senko scale constant.

## 2. Post-use gun exit must become a DETACHED physical object

Owner feedback: current gun disposal reads as “falls out of hand then fades.”

### Current defect

The current pose ghost:
- remains drawn relative to the fighter;
- stores `exitVx` / `exitG` but does not use full world-space 2D exit motion;
- mostly changes vertical `drop` + rotation;
- therefore different `EXIT_PROFILES` are less perceptually distinct than their data implies.

### New exit law

When the final attack commit completes:

1. detach the weapon from the fighter at its exact current equipped world transform;
2. create a bounded presentation-only `detachedWeapon` object containing:
   - world x/y;
   - vx/vy in aim-relative or world space;
   - rotation + angular velocity;
   - gravity;
   - optional one floor/wall reaction;
   - life;
   - exit profile key;
3. fighter movement after consume must NOT drag the discarded gun;
4. alpha remains 100%/near-100% for the physical motion and may fade only in the final ~10–15%;
5. floor/wall motion should be readable before cleanup;
6. no instant disappear.

### Shared exit language + per-gun identities

Keep the data-driven exit profiles but make them observably different. Examples:

- Colt: crisp backward/up flick, short pistol spin;
- Glock: faster compact cartwheel;
- TEC-9: magazine-heavy rear tumble;
- MAC-10: violent compact tumble;
- Beretta 93R: lateral side-spin;
- MP5: receiver settles then rear/down toss;
- P90: flat roll-out;
- Z15 family: magazine-drop beat + rifle body fall/toss, shared across skins;
- Mossberg: long heavy drop/throw after pump identity;
- Desert Eagle: slower heavy handgun spin;
- AK-47: stock-heavy rear kick/toss;
- M16: long-body rear toss;
- MBR: optic-led settle then long rifle drop;
- SPAS: body punch/recoil then long drop;
- Sawed-off: break-open finish + two hulls + short backward body toss;
- Magnum 500: cylinder/case spill beat + heavy revolver fall;
- M249: nose-heavy slump with forward mass;
- MBR2: deeper rear recoil/drop than MBR;
- Szecsei & Fuchs: long ceremonial rifle drop;
- Snipex: strongest rear kick with a long heavy fall;
- Jackhammer: cassette-spin-style finish + shotgun body recoil/drop.

Semantic component extraction remains forbidden unless a trustworthy part map exists. Whole-body exits are acceptable; generic identical exits are not.

## 3. Rarity color REPLACES the existing pickup shadow

Owner feedback: the game already has one black oval pickup shadow. Current rarity glow is layered on top of another black oval and looks wrong.

New law for REVEALED offensive pickups:

- render exactly ONE pickup under-shadow/under-light system;
- remove the separate neutral black oval for tiered offensive pickups;
- use the existing shadow ellipse position as the rarity presentation surface;
- T1–T5 replace its color with their tier color;
- preserve soft radial/blurred edges and tier strength hierarchy;
- allow a darker, lower-alpha center of the SAME tier hue for contact grounding, but do not draw a second black ellipse beneath it;
- hidden TELEGRAPH remains rarity-neutral;
- weapon sprite stays untinted.

Applies to gun, melee and grenade.

## 4. Gunshot audio must tail off instead of hard-cut

### Current defect

Gun samples are sliced through `AudioBufferSourceNode.start(..., duration)` with constant gain. The end of a slice can therefore read as abruptly cut.

### New playback envelope

Add per-entry/per-recipe bounded fade-tail support:
- tiny anti-click attack if necessary (1–4 ms);
- maintain authored body;
- linear/exponential gain ramp to near-zero before the source stop;
- source stops only after the gain tail reaches near-zero.

Initial fade-tail windows:
- fast automatic slice: ~25–45 ms;
- light pistol: ~60–90 ms;
- heavy handgun: ~80–120 ms;
- shotgun: ~100–150 ms;
- precision/Snipex: ~140–220 ms.

The exact tail must be auditioned. Do not wash rapid automatic fire into an indistinct continuous bed.

Existing approved gun source files remain authoritative; this is playback-envelope work, not random re-sourcing.

## 5. Casing / hull LAND sound

A suitable light metal impact already exists in the repo:
`public/assets/arsenal/av/sfx/impact/impactPlate_light_001.ogg`.

Current `casing_drop` playback occurs when the casing is spawned, which is perceptually wrong.

New law:
- do NOT play casing floor SFX on casing spawn;
- emit a semantic `casing_land` / `hull_land` event on the first meaningful floor contact;
- play the impact there;
- one landing sound maximum per casing/hull;
- bounded voice cap / throttle prevents a full-auto burst becoming an audio wall;
- volume may scale modestly with impact speed;
- handgun/rifle brass may use the existing light plate impact;
- shotgun hull may use an already-owned softer suitable impact if browser audition proves it better.

Only if the current owned library cannot produce a convincing landing read may the Agent source one new legally-usable SFX, with provenance. Do not browse/download first when an owned candidate already exists.

## 6. External P1 skill cooldown HUD

Add a compact DOM cooldown indicator OUTSIDE the battlefield.

Requirements:
- mode-scoped to Arsenal;
- positioned near the P1 HUD / outside world canvas;
- never rendered inside battlefield;
- driven from the real manual-skill gate / live fighter data;
- updates every frame or HUD refresh;
- READY state is visually distinct from counting cooldown;
- for multi-active fighters, display each gated active compactly rather than hiding all but one;
- labels must be readable but concise;
- no effect on gameplay timing.

Minimum Newbie read:
- `J · READY` when cooldown is zero AND a valid REVEALED pickup exists;
- `J · 6.4s` while cooling down;
- `J · —` or a neutral unavailable state when cooldown is zero but no valid revealed pickup exists.

## 7. Newbie invalid J is a true NO-OP

Owner requirement: pressing J as Newbie when there is nothing valid on the arena is an action that is not recognized.

Therefore when P1 Newbie has no eligible REVEALED pickup:
- KeyJ must not create/buffer a skill pulse;
- no cooldown starts;
- no dash starts;
- no fail SFX;
- no gameplay log claiming an activation;
- cooldown HUD remains unavailable/neutral;
- a pickup appearing during the following second must NOT retroactively consume that old J press.

When a valid pickup exists and cooldown is ready, one J press activates normally and starts the 10s cooldown.

P2 Newbie auto behavior may continue to retry automatically when appropriate.

## 8. Full melee behavior correction pass

Do not redesign melee from scratch. Audit all five at normal speed:
SABRE, BATTLE_AXE, DAGGER, SPEAR, SPIKED_CLUB.

### Known concrete defects to fix

1. **Ricochet cap off-by-one**
   Current code decrements then exits only when `ricochetsLeft < 0`.
   A budget of 1 can therefore survive two wall contacts.
   The fixed maximums must be EXACT:
   - Battle Axe = 1
   - Spiked Club = 1
   - Spear = 2
   - Sabre = 3
   - Dagger = 4

2. **Thrown visual scale**
   Current thrown rendering forces every melee sprite to long-side ~110.
   Use the same authored/canonical melee scale language as floor/equipped rendering so Spear, Axe, Dagger, etc. retain distinct size.

3. **Release origin**
   Throw should leave from the currently equipped weapon/hand pose, not visually pop from fighter center.

4. **Flight identity**
   Weapon-specific rotation/tumble:
   - Spear: mostly tip-first / low-spin;
   - Dagger: fastest spin/tumble;
   - Axe: heavy asymmetric tumble;
   - Sabre: moderate blade spin;
   - Club: slow heavy tumble.

5. **Collision geometry**
   Replace one fixed `radius:15` assumption with weapon-aware collision geometry derived from its rendered dimensions/shape proxy. Swept collision remains mandatory.

6. **Pin read**
   Pin point/orientation must make the weapon tip/head appear embedded rather than placing the sprite center unnaturally through the target.

7. **Exit**
   After pin or exhausted ricochet budget, physical exit remains readable before final cleanup.

### Preserve
- decision at pickup: in-range strike / out-of-range throw;
- centralized +50% melee damage;
- no homing after release;
- fighter.dir independence;
- ~1s pin;
- approved +~12% throw-speed pass unless owner playtest after correction requires movement within the frozen +10–15% window.

Add deterministic + browser coverage for each weapon's strike, throw, exact bounce cap, pin, and exit.

## 9. Shotgun pellets must be capable of crossing the arena

Owner feedback: shotgun pellets visibly terminate mid-map.

For SHOTGUN-family / AUTOSHOT pellet projectiles:
- projectile lifetime must be sufficient to traverse the full arena diagonal plus a small safety margin;
- do not terminate merely because the old short `bulletLife` expires;
- keep swept collision;
- keep the authored cone/spread so hit probability naturally falls with distance;
- do not turn pellets into slow floating balls.

Prefer deriving TTL from:
`(arenaDiagonal + safetyMargin) / bulletSpeed`
rather than independent magic lifetimes per shotgun.

Mossberg, SPAS, Sawed-off and Jackhammer must all use the new travel law.

This change concerns travel distance. Do not silently rebalance damage in the same patch unless real-browser evidence reveals a severe regression.

## 10. Arsenal Quest V1 — first 20 stages

Build a real data-driven quest ladder. These are the FIRST 20 stages, designed for future extension.

### Global quest rules
- difficulty progression comes primarily from opponent roster identity, not hidden HP/damage cheating;
- preserve 100 HP and normal Arsenal weapon/rarity rules for both sides;
- player chooses P1 shell;
- stage fixes P2 opponent;
- stage N+1 unlocks after winning stage N;
- unlocked/completed progress persists locally with a versioned key;
- loss allows retry;
- completed stages are replayable;
- no account/backend dependency;
- quest UI is DOM/outside the battlefield;
- stage table is data-driven, not twenty hard-coded menu functions.

### Authored first-20 opponent order

1. PAINTER
2. DRUM
3. CARD
4. ICE
5. MATH
6. BLADE
7. TOXIC
8. ORBIT
9. FLASH
10. ELECTRIC
11. VAMPIRE
12. SAW
13. HUNTER
14. WOLF
15. CRYSTAL
16. MAGNET
17. BLACK_HOLE
18. WITCH
19. TIME
20. MONK / live KUNGFU identity

This order intentionally ramps:
simple periodic/readable hazards -> persistent/contact pressure -> mobility/control -> sustain/tracking -> hard battlefield control -> rewind/curse -> combo/pin boss.

The following identities are intentionally left for later quest chapters rather than squeezed into the first 20:
RUBBER, STRING, MIRROR, NOVA/GALAXY, VIRUS, MATH_V2, SNIPER, SLIME, WIND/PUPPET, PIRATE, SUPERSTAR, NEWBIE and other remaining roster identities.

### Quest UX minimum

Add an Arsenal Quest stage screen outside the battlefield:
- 20 stage cards/nodes;
- locked / unlocked / completed state;
- opponent name and existing portrait/icon where available;
- click unlocked stage -> choose P1 shell -> start with fixed P2 stage opponent;
- on win: mark complete, unlock next, offer NEXT / REPLAY / QUEST MAP;
- on loss: RETRY / QUEST MAP;
- normal free-play Arsenal selection remains available separately and unchanged.

Use existing selection/portrait assets where possible. Do not build a second character renderer.

### Persistence

Use a versioned local key, e.g.
`apexChaos.arsenalQuest.v1`

Minimum:
`{ unlockedThrough, completedStages }`

Handle malformed/absent storage safely.

## 11. Verification / owner-ready definition

Automated:
1. Senko guns no longer use per-gun normal visual longSide overrides;
2. one family scale constant controls all 24 gun sizes;
3. source intrinsic dimensions are preserved in generated metadata;
4. floor/equipped/exit use consistent scale;
5. detached post-use guns are world-space and no longer follow fighter;
6. representative exit profiles have measurably different x/y/spin trajectories;
7. tier under-light replaces, rather than stacks with, black floor shadow;
8. gunshot gain reaches near-zero before source slice stop;
9. casing landing audio triggers on first floor contact, not spawn;
10. cooldown HUD reflects actual gate state;
11. Newbie invalid J creates no pulse/cooldown/sound/log;
12. exact melee bounce caps 1/1/2/3/4;
13. five melee preserve weapon-specific thrown scale/motion/collision/pin;
14. all shotgun-family pellets can survive the full arena diagonal;
15. quest stage table has exactly the authored first 20 order;
16. sequential unlock/persistence works;
17. free-play Arsenal remains compatible.

Real browser:
- representative gun-scale lineup: handgun, PDW/SMG, rifle, LMG, Snipex in one deterministic frame;
- at least six distinct post-use gun exits captured/observed at normal speed;
- T1/T3/T5 pickups show ONE shadow/under-light each;
- pistol/auto/shotgun/precision audio tails have no audible hard chop;
- casing/hull impacts audibly occur at floor contact;
- P1 cooldown DOM visible outside battlefield;
- Newbie no-target J is visually/audibly a no-op;
- five melee reviewed at normal speed;
- shotgun pellets visibly persist across arena;
- Quest stages 1, 10 and 20 launch the correct opponent;
- win stage 1 unlocks stage 2; persistence survives reload.

## 12. Git law

Implementation work stays on `arena/01a0cf5e-apex-chaos`.
Keep `playtest/arsenal` frozen at the currently accepted owner-playtest build until this revision passes audit.
Do not touch `main`.
Do not force-update refs.

This document is the owner authority for the next pass.
