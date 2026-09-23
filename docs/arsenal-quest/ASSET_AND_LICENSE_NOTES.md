# Arsenal Quest — Asset and License Notes

## Coding-pass policy

Do not block the core implementation on downloading or integrating additional bullet/VFX/SFX packs.

For the first integrated Apex prototype:
- weapon gameplay first,
- reuse existing Apex projectile/effect/audio capabilities,
- keep presentation replaceable.

The curated P0 weapon binary files are not required for architecture work. Use logical sprite keys from `P0_ASSET_MANIFEST.csv`; keep placeholder rendering isolated from gameplay.

## Source family 1 — JoeRaig Ancient Armory

The source ZIP supplied by the project owner contained `Readme_License.txt` stating that the pack was created under Creative Commons Zero (CC0), permits personal/commercial use and modification, and does not require attribution. It also asks not to redistribute/resell the pack standalone.

P0 assets from this family:
- M01 Sabre
- M04 Battle Axe
- M08 Dagger
- M10 Spear
- M12 Spiked Club
- D03 Swirl Shield
- D07 Tower Shield

## Source family 2 — Kay Lousberg 2D Guns

The supplied source pack contains separate PNG and higher-resolution PNG variants plus projectile/ammo art. Project notes treat this family as the gun source for the curated set.

P0 assets from this family:
- G01 Pistol
- G03 Shotgun
- G05 SMG
- G08 Sniper Rifle
- G10 Grenade

Before a production release, preserve the original source-pack archive/license evidence outside the runtime bundle and perform a final license audit. Do not redistribute an original source pack as a standalone download from this repository.

## Future presentation assets

Later acquisition targets, not part of this coding task:
- bullet/projectile sprites
- muzzle flashes
- melee slash VFX
- explosion VFX
- gun SFX
- melee/impact/shield SFX

Gameplay code should expose replaceable hooks for these rather than bake visuals/audio into weapon logic.
