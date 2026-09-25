# APEX CHAOS — CHAMBER FLOOR READABILITY AMENDMENT

**Date:** 2026-09-25
**Authorized branch:** `arena/01a0cf5e-apex-chaos`
**Status:** OWNER-FROZEN AMENDMENT FOR THE CURRENT OWNER-FEEDBACK CORRECTION RUN

This amendment supersedes only the floor-palette preservation clause from:
`OWNER_FEEDBACK_HEAL_SPLATTER_DAMAGE_AUDIO_SMOOTHNESS_AUTHORITY.md`

It does not reopen Chamber geometry, weapon balance, rarity law, or accepted gameplay.

## 1. Owner-visible problem

The current light floor is too bright / washed-out in play:
- weapon pickup positions do not command enough attention;
- bright bullets/projectiles are harder to track;
- muzzle flashes, bombs, explosions and impact glows lose punch;
- damage numbers and stains have less visual separation than intended.

This is a gameplay-readability issue, not merely a color preference.

## 2. New direction: mid-tone cool industrial graphite

Do NOT return to the old near-black floor.

Do NOT keep the current light-gray values.

Target a mid-value neutral/cool graphite that leaves contrast room both below and above it.

Starting palette authority:

- playable floor base: `#626A74`
- center/material lift: approximately `#727B86`
- outer playable falloff: approximately `#4F5761`
- wall band: approximately `#3C434C`
- inner rail / hard boundary: approximately `#2C3239`
- grid/ticks: cool near-black at restrained alpha
- tiny specular/static accents may use low-opacity cool light, never a bright lane

These values may be tuned narrowly during browser verification, but the final floor must stay in this mid-tone graphite family. Do not drift back to near-white/light concrete or near-black charcoal.

## 3. Readability hierarchy

The final Chamber composition must establish this hierarchy:

1. dangerous/important moving gameplay VFX and projectiles;
2. active/revealed pickups and their local under-light;
3. fighters and held weapons;
4. damage/heal numbers;
5. blood/splatter history;
6. floor/grid/chamber material.

The floor must be visually subordinate.

## 4. Pickup local-contrast well

Do not rely on floor color alone.

For each revealed offensive pickup:
- preserve rarity hue;
- add or tune a restrained dark local grounding/contact well beneath the pickup so dark weapon silhouettes remain readable;
- rarity glow/under-light sits above or within that grounding well;
- the effect must not look like the old large black pickup oval;
- keep it soft, compact and material-aware.

For heal pickups:
- retain the green support under-light;
- add enough local dark grounding that the green pulse and sprite remain readable without becoming neon signage.

Hidden/telegraph pickups keep their existing reveal grammar. Do not expose hidden weapon identity.

## 5. Bright-effect verification

Browser evidence at normal speed/scale must show the new floor with at least:

- a dark/black weapon pickup;
- a bright projectile/bullet in motion;
- muzzle flash;
- grenade/bomb or explosion/impact flash;
- rarity glow;
- normal vermilion damage popup;
- heal green popup;
- at least one victim-colored persistent splatter.

The bright VFX must visibly pop from the floor instead of blending into it.

## 6. Dark-object verification

The new darker floor must not recreate the old dark-floor failure.

Prove:
- black/dark gun silhouettes remain readable because the floor is mid-tone and the pickup has local grounding/under-light separation;
- dark fighter details do not disappear;
- dark splatter cores remain distinguishable from wall/edge material.

## 7. Performance

Preserve Chamber cache architecture:
- paint once;
- one cached Chamber draw per frame;
- invalidate only on size/theme change.

Do not introduce per-frame gradients/material rebuilding.

Pickup local-contrast visuals must use existing cached/cheap architecture where appropriate.

## 8. Scope lock

Do not:
- alter Chamber geometry;
- add center obstacles;
- add bright lanes;
- change spawn coordinates or gameplay;
- alter rarity probabilities;
- reduce VFX/SFX quality;
- change projectile brightness merely to compensate for the floor unless a real existing bug is found;
- modify `main`;
- move `playtest/arsenal`.

This amendment is part of the CURRENT owner-feedback correction run, together with:
1. heal transaction completeness;
2. damage atlas real edge/halo proof;
3. real-rAF smoothness acceptance.

The Agent should complete all four before asking for owner acceptance.
