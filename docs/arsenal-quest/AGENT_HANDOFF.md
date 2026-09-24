# ARSENAL QUEST — AGENT IMPLEMENTATION HANDOFF

Status: AUTHORITATIVE IMPLEMENTATION BRIEF  
Target branch: `prototype/arsenal-quest`  
Do not modify or merge into `main` unless the owner explicitly asks later.

> **IMPORTANT CORRECTION OVERRIDE:** Read `docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md` before implementation. Its weapon-art, reveal-timing, VFX-placement, and related acceptance rules supersede conflicting wording in this older brief.

## 0. Read this first

This file replaces earlier conversational descriptions and the old one-pickup prototype behavior.

The current product hypothesis is:

> Reuse Apex Chaos' existing auto-battle movement/combat engine, but make both fighters fundamentally unarmed and force them to contest a continuously spawning shared arsenal. Spawn locations telegraph first; weapon identity remains hidden until an eligible fighter is predicted to reach that slot roughly 1–2 seconds later; multiple pickups may coexist.

The implementation goal is NOT to build the full game. It is to prove whether the shared-weapon arena is fun before adding progression.

## 1. Hard constraints

These are non-negotiable.

1. **Reuse Apex Chaos. Do not recreate the engine.**
2. HERO and RIVAL use the existing Apex movement/bounce/collision law.
3. HERO and RIVAL start at 100 HP, unarmed, no intrinsic attack, no skill kit.
4. Spawn cadence is timer-driven and **independent of whether old pickups have been collected**.
5. Multiple telegraphs / revealed pickups may coexist.
6. A spawn location appears BEFORE the weapon identity is known.
7. Each slot gets a random **1.2–1.8 second reveal look-ahead threshold**. This is NOT a timer after spawn: reveal occurs only when an eligible fighter's predicted time-to-contact enters that threshold.
8. Before reveal, the slot is visible but:
   - shows no weapon identity/category,
   - cannot be collected,
   - cannot trigger weapon behavior.
9. After reveal, first fighter to touch it equips it.
10. Weapons are consumable/temporary. After their attack sequence or defensive effect resolves, holder returns to UNARMED.
11. Do not implement quest progression, leveling, unlocks, shop, rarity, inventory, economy, campaign, bosses, or weapon-pathfinding yet.
12. Do not wait for future projectile/VFX/SFX asset downloads. Reuse existing Apex visuals/audio as temporary presentation.
13. Do not break existing Apex modes.
14. Keep the new mode isolated and removable.

## 2. Repository / reuse map

Before editing, inspect the current branch and verify paths/functions still exist.

### Core engine
`public/apexEngine.js`

This already owns the important classic-script globals including:
- `fighters`
- `projectiles`
- `particles`
- `floatingTexts`
- `shockwaves`
- game state / timing
- arena dimensions
- Fighter runtime
- auto movement / bounce
- collision / damage
- projectile update/draw paths
- camera shake / hit stop

Do NOT duplicate these systems in a standalone canvas app.

### Existing reusable presentation runtimes
`public/game/core/apexBattleAudioRuntime.js`  
`public/game/core/apexBattleSfxRuntime.js`  
`public/game/core/apexRenderPrimitives.js`  
`public/game/core/apexCombatEffectsRuntime.js`

Prefer existing functions such as particles, floating text, shockwaves, hit-stop, camera shake and current audio hooks after verifying their exact names/signatures.

### Runtime registration
`src/game/runtimeManifest.js`

Register Arsenal Quest runtime files here in dependency order.

### React shell / menu
`src/App.jsx`

Only add the minimum UI needed to enter/exit the mode and show the mode HUD. Do not implement gameplay logic in React.

### Existing runtime tests / patterns
See `tools/testShotgunRuntime.mjs`, `tools/testKatanaRuntime.mjs`, `tools/testFangRuntime.mjs`, and related scripts for repository testing conventions.

## 3. Recommended new file layout

Prefer an isolated feature folder:

```
public/game/arsenal/
  arsenalQuestConfig.js
  arsenalWeaponRuntime.js
  arsenalSpawnRuntime.js

public/game/modes/
  arsenalQuestRuntime.js

tools/
  testArsenalQuestRuntime.mjs
```

Do not put hundreds of Arsenal-specific lines directly into `src/App.jsx`.

Do not fork/copy the whole `apexEngine.js`.

Classic-script globals are acceptable because the existing runtime architecture already uses them. Follow repository execution-order conventions.

## 4. Blank fighter model

Both combatants must use the existing Fighter machinery without inheriting a champion's skill kit.

Preferred approach:
- create a neutral Fighter-compatible type/config for Arsenal Quest,
- standard 100 max HP,
- no `update` ability logic,
- no `onCollide` intrinsic damage,
- no rage skill,
- normal Apex movement/bounce/collision behavior remains intact.

They should only deal meaningful damage through equipped Arsenal weapons.

Names for first pass:
- left side: `HERO`
- right side: `RIVAL`

Do not add these to the normal 32-fighter roster unless technically necessary.

## 5. Spawn system — authoritative behavior

Initial tuning constants should be centralized in `arsenalQuestConfig.js`.

Suggested first-pass values:

```
SPAWN_CADENCE_SECONDS = 3.0
REVEAL_LOOKAHEAD_MIN_SECONDS = 1.2
REVEAL_LOOKAHEAD_MAX_SECONDS = 1.8
SPAWN_MARGIN = 90
PICKUP_RADIUS = 42
```

Optional safety values may be configurable, but must NOT restore one-at-a-time spawning:
- pickup lifetime after reveal: ~20s
- soft active-pickup cap: 8

If using a cap for safety, log when it suppresses a spawn. The normal intended state must easily allow 3+ simultaneous pickups.

### Slot lifecycle

```
TELEGRAPH
  -> REVEALED
  -> PICKED_UP
  -> REMOVED
```

At `TELEGRAPH`:
- visible location marker/pulse/question mark,
- no weapon sprite,
- no category hint,
- no color-coding that gives away the weapon,
- non-interactable.

While TELEGRAPH:
- keep weapon identity null / hidden,
- estimate future time-to-contact for each living eligible fighter,
- remain hidden for as long as nobody is predicted to touch within the slot's 1.2–1.8s look-ahead threshold.

When earliest predicted contact enters that threshold:
- select/reveal the actual weapon at that moment,
- show the committed real weapon sprite,
- make collectible immediately.

Spawn cadence continues regardless of slot lifecycle. A slot may remain hidden for many seconds.

### Important example

```
t=0.0 slot A telegraph
t=3.0 slot B telegraph   (A may still be hidden)
t=6.0 slot C telegraph   (A/B may both still be hidden)
t=8.2 HERO trajectory now predicts contact with A in 1.5s
t=8.2 A reveals Shotgun
t≈9.7 HERO reaches A if trajectory remains valid
```

This is a core product rule.

## 6. Pickup rules

A revealed floor pickup is collected by the first living fighter whose collision volume overlaps it.

On pickup:
- remove it from floor state,
- equip holder,
- log the event,
- play temporary Apex pickup/impact feedback,
- holder remains governed by normal Apex movement.

For this first prototype, a fighter should normally hold at most one Arsenal item.

If a fighter already holds a weapon when touching another revealed pickup, default behavior for P0:
- do NOT collect the second item.
- Leave it available for the opponent.

Do not add inventory or weapon swapping yet.

## 7. P0 arsenal — exactly 12 behaviors

All numeric values are first-pass tuning, not sacred balance. Keep them centralized/configurable.

### Ranged

**Pistol**
- 3 quick aimed shots
- short interval
- low damage per shot
- moderate accuracy
- consumed after shot 3

**Shotgun**
- 1 close-range cone blast
- multiple pellets/rays
- high close-range damage
- strong knockback
- consumed after blast

**SMG**
- 8-shot burst
- fast interval
- moderate spread
- low damage per bullet
- consumed after burst

**Sniper**
- visible aim/charge telegraph around 0.7–0.9s
- 1 very accurate high-damage shot
- should feel dangerous before firing
- consumed after shot

**Grenade**
- one thrown/bouncing projectile
- delayed fuse
- area explosion with falloff
- consumed immediately after throw; grenade remains in world until resolved

### Melee

Critical rule: **do not consume melee instantly on pickup.**

Melee stays equipped until an opponent enters valid activation geometry.

**Sabre**
- fast wide sweep
- medium reach
- low wind-up

**Battle Axe**
- slower heavy chop
- high damage
- strong knockback
- visible wind-up

**Dagger**
- short range
- brief forward dash/stab when target enters trigger range
- precise hitbox

**Spear**
- longest melee reach
- narrow lunge/thrust
- strong push

**Spiked Club**
- short-medium range smash
- moderate/high damage
- brief stun + knockback

### Defensive

**Swirl Shield**
- stays equipped until it reflects one eligible hostile projectile or expires
- reflected projectile ownership/source should switch correctly
- consumed after successful reflect

**Tower Shield**
- temporary fortress state, first pass ~2.8s
- large damage reduction / frontal guard
- movement speed penalty while active
- consumed when duration expires (or a clearly implemented durability rule)

## 8. Projectile / effects policy

New high-quality bullet, muzzle-flash, slash, explosion and SFX packs will be added later.

Do NOT block code waiting for them.

For now:
- use the existing global `projectiles` collection where practical,
- reuse existing Apex projectile movement/collision helpers or patterns,
- reuse existing particles/shockwaves/flash,
- reuse existing hit-stop and camera shake,
- reuse existing SFX/audio hooks.

If Arsenal-specific projectile types are necessary, implement them in the Arsenal runtime and integrate by wrapping/extending current update/draw paths. Avoid copying the entire projectile engine.

Keep visual implementation behind weapon/projectile abstractions so future PNG/VFX/SFX swaps do not require gameplay rewrites.

## 9. Weapon runtime interface

Use a centralized registry/data-driven shape. Exact syntax may vary, but avoid scattered string-conditionals across the engine.

Conceptually:

```
weaponDefinition = {
  id,
  category,
  pickupSpriteKey,
  onEquip(ctx),
  update(ctx, dt),
  canActivate(ctx),
  activate(ctx),
  onIncomingHit?(ctx, hit),
  cleanup(ctx)
}
```

A single holder state should answer:
- current weapon id
- weapon phase
- ammo/remaining sequence if relevant
- elapsed timers
- whether it has been consumed

## 10. No weapon-seeking AI yet

For P0, HERO and RIVAL do NOT deliberately pathfind toward weapon pickups.

Both use the normal Apex movement/bounce law.

Reason: first test whether arena geometry + random spawn timing + incidental movement already produces interesting races.

Later enemy archetypes may intentionally break this rule:
- Thief seeks pickups
- Magnet pulls pickups
- Spider blocks routes
- Wolf gains speed
etc.

Do not implement those now.

## 11. Debug and observability — required

F3 toggles an Arsenal debug overlay.

Show at minimum:

```
ARSENAL QUEST DEBUG
spawn in: 1.7s
active slots: 4
telegraphs: 1
revealed: 3

HERO  HP 68/100   weapon: SPEAR
RIVAL HP 44/100   weapon: NONE
```

Structured console events are required:

```
[AQ] SPAWN_SLOT id=7 x=... y=...
[AQ] REVEAL id=7 weapon=SHOTGUN
[AQ] PICKUP id=7 fighter=HERO weapon=SHOTGUN
[AQ] USE fighter=HERO weapon=SHOTGUN
[AQ] HIT source=HERO target=RIVAL weapon=SHOTGUN damage=...
[AQ] CONSUME fighter=HERO weapon=SHOTGUN
```

Avoid noisy per-frame logging.

Expose a small inspection API, e.g. `window.getArsenalQuestDebugState()`.

## 12. Entry / exit behavior

Add one explicit menu entry: `ARSENAL QUEST PROTOTYPE`.

Entering mode must:
- hide conflicting menus,
- reset Arsenal state,
- create blank HERO/RIVAL using Apex Fighter runtime,
- reset HP to 100,
- clear prior normal-match projectiles/effects as needed,
- begin independent spawn cadence.

Exiting / returning to menu must:
- stop Arsenal timers,
- clear Arsenal slots/weapon state,
- not leak keyboard listeners or intervals,
- restore normal Apex behavior.

Do not hijack normal Play, Tournament, Solo, or Apex Control.

## 13. Asset plan for this coding pass

Weapon art is now committed and mandatory for normal gameplay rendering.

P0 logical art keys:

```
G01 Pistol
G03 Shotgun
G05 SMG
G08 Sniper Rifle
G10 Grenade
M01 Sabre
M04 Battle Axe
M08 Dagger
M10 Spear
M12 Spiked Club
D03 Swirl Shield
D07 Tower Shield
```

Source families:
- Kay Lousberg 2D Guns — gun family
- JoeRaig Ancient Armory — melee/shield family

Runtime atlas:
- `public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.png`
- `public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.json`

Colored circles / 3-letter tags are no longer accepted as the primary normal-gameplay representation of revealed or equipped weapons. See `docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md` for the mandatory rendering rules.

Also see `docs/arsenal-quest/P0_ASSET_MANIFEST.csv` and `docs/arsenal-quest/ASSET_AND_LICENSE_NOTES.md`.

## 14. Non-goals

Explicitly do not build:
- quest selection/map
- hero XP/levels
- permanent stat upgrades
- unlock tree
- rarity tiers
- inventory
- equipment screen
- economy/currency
- shops
- meta progression
- boss roster
- old 32 champions as bosses
- enemy archetype AI
- weapon seeking
- multiplayer
- network synchronization
- final UI polish
- final sound pack integration
- final projectile/VFX asset integration
- all 30 curated weapons

If tempted to add one of these, stop.

## 15. Acceptance gates

The task is NOT accepted because it compiles.

It is accepted only when all of these are demonstrated:

1. Arsenal mode runs inside the existing Apex application.
2. Normal Apex modes still launch.
3. HERO/RIVAL use Apex movement/bounce/collision, not a new movement engine.
4. Both start unarmed at 100 HP.
5. New spawn slots appear at the configured cadence even while old pickups remain.
6. At least 3 floor pickups/telegraphs can coexist.
7. Reveal is proximity-predicted: a slot may stay hidden >5s, and reveals only when an eligible fighter's predicted contact time enters its 1.2–1.8s look-ahead threshold.
8. Telegraph gives no weapon identity/category.
9. Telegraph cannot be collected.
10. Both HERO and RIVAL can collect revealed pickups.
11. Holder cannot collect unlimited additional items.
12. All 12 P0 items have distinct functioning behavior.
13. Melee does not waste itself immediately after pickup.
14. Ranged sequences consume correctly and return fighter to unarmed.
15. Swirl Shield reflects an eligible projectile.
16. Tower Shield meaningfully reduces/blocks damage while active.
17. Weapon cleanup does not leave stale owner/target references.
18. F3 debug overlay works.
19. Structured AQ event logs work.
20. No uncaught error during a continuous five-minute simulation.
21. `pnpm build` passes.
22. Existing relevant runtime tests remain passing or failures are documented with evidence that the failure predates Arsenal changes.

## 16. Required verification output from the coding agent

When done, report:

- branch + final commit SHA
- exact files changed
- what Apex systems were reused
- what new Arsenal files were added
- build result
- test commands + results
- five-minute simulation result
- screenshots/GIF or captured frames showing:
  1. hidden telegraph
  2. multiple simultaneous pickups
  3. HERO pickup
  4. RIVAL pickup
  5. one ranged attack
  6. one melee attack
  7. shield behavior
- known defects / compromises
- no claims of success without visual/runtime evidence

## 17. Implementation philosophy

Keep rules simple and outcomes complex.

Do not solve uncertainty by adding systems.

The product test is:

> When several unknown spawn points are appearing on a chaotic Apex arena, then revealing different weapons while two unarmed fighters bounce around and contest them, is the fight inherently fun to watch before any progression exists?

Everything in this branch should serve that question.
