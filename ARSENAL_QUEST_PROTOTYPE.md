# Arsenal Quest — Core Toy Prototype

Branch: `prototype/arsenal-quest`

## Purpose

Validate one question before building quests, progression, bosses, or a larger arsenal:

> Is it fun to watch two auto-moving fighters contest the same randomly spawned one-use weapon?

## Core rules

1. HERO and RIVAL begin unarmed at 100 HP.
2. Both move automatically with constant-direction arena bounce and fighter collision.
3. Only one shared pickup is active at a time.
4. The first fighter to touch the pickup owns its effect.
5. Weapons are consumable: after their action resolves, the fighter becomes unarmed again.
6. A new random pickup is then allowed to spawn.

## P0 arsenal

- Pistol — 3 quick shots
- Shotgun — cone blast
- SMG — 8-shot burst
- Sniper — telegraphed heavy shot
- Grenade — bouncing timed explosion
- Sabre — fast sweep
- Battle Axe — heavy chop
- Dagger — dash stab
- Spear — long lunge
- Spiked Club — stun smash
- Swirl Shield — reflects one projectile
- Tower Shield — temporary high-damage guard with movement slowdown

## Prototype implementation notes

- Melee weapons stay equipped until the rival enters a valid activation range; they are not wasted immediately after pickup.
- Ranged shots use simple target leading so auto-battle shots can connect without homing.
- Defensive pickups are part of the shared drop pool, so denial and survival are both valid pickup outcomes.
- This branch intentionally does not yet implement quest progression, hero leveling, bosses, inventory, rarity, or the remaining 18 curated assets.

## Runtime validation performed

The standalone prototype was executed in Chromium with no page errors.

Controlled hit tests confirmed all ten offensive P0 weapons can damage the rival:
Pistol, Shotgun, SMG, Sniper, Grenade, Sabre, Battle Axe, Dagger, Spear, and Spiked Club.

Swirl Shield reflected a projectile during the controlled test.
Tower Shield reduced incoming Sniper damage during the controlled test.

The next design decision should come from watching/rematching the toy, not from adding progression systems.
