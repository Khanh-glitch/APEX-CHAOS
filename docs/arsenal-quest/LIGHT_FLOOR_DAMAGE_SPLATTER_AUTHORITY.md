# APEX CHAOS // LIGHT FLOOR + DAMAGE SPLATTER VISUAL AUTHORITY

**Date:** 2026-09-25  
**Game branch:** `arena/01a0cf5e-apex-chaos`  
**Audited current tip:** `e591e967085c4f719510b7d90f287012e9c5f4cc`  
**Status:** OWNER-FROZEN ADDITION

This authority augments:
- `GUN_PICKUP_READY_AND_CASING_AUDIO_AUTHORITY.md`
- `POST_PASS1_NEXT_EXECUTION_PLAN.md`

It adds two owner-visible requirements:
1. Chamber 01 floor becomes light industrial gray for weapon readability.
2. Direct damage creates a blood-like color-matched splatter that briefly sprays and leaves a persistent floor stain.

---

# 1. Light gray Chamber 01

## Problem

Current Chamber 01 is dark graphite:
- base `#17181c`
- dark radial gradient
- wall band `#202227`

Many gun sprites are dark/black and lose silhouette against this floor.

## Required direction

Keep the same industrial testing-chamber geometry, grid, wall ticks, rails and cached-background architecture, but switch the playable floor to a **light neutral industrial gray**.

Target palette:

- floor base: `#A4A7AC`
- center/material lift: around `#B9BCC1`
- edge falloff: around `#878C93`
- wall band: around `#747980`
- inner rail / boundary: around `#656A71`
- grid/ticks: dark neutral lines, low opacity

These are starting values, not permission to create a white room.

Observable requirements:
- black/dark gun silhouettes are immediately readable;
- white/cream effects do not disappear into the floor;
- rarity under-light remains readable;
- fighter colors remain distinct;
- arena still feels industrial, not sterile white;
- no bright center lane or obstacle.

## Performance

Preserve Pass 1 chamber caching:
- paint once;
- one cached background draw per frame;
- cache invalidates only when size/theme changes.

Do not regress to rebuilding gradients/grid each frame.

---

# 2. Damage splatter — no external download required

The repository already contains a suitable source texture:

`public/assets/fang_v1/speckBlood.webp`

Audited metadata:
- 770 × 766
- transparent background
- clean alpha
- existing FANG runtime already tints this texture with `source-atop`

Therefore do **not** download a generic red blood pack.

A pre-colored red asset would conflict with the owner's requirement that the splatter color belongs to the fighter receiving damage.

Use the existing FANG blood-speck texture as an alpha/organic texture source and build the Arsenal effect in code.

---

# 3. Visual behavior

When a fighter receives **real direct damage > 0**:

1. emit a very short directional spray at the impact position;
2. immediately stamp an irregular stain onto the arena floor beneath that location;
3. stain color derives from the damaged fighter's own color;
4. stain remains on the floor for the rest of the current match/stage.

Do not create red human blood unless the damaged fighter itself is red.

This is stylized fighter-fluid feedback, but its **shape/motion should behave like believable liquid splatter**.

## Do not trigger on

- blocked / shielded hit that deals 0;
- MISS;
- pickup;
- TELEGRAPH / REVEAL;
- status/DoT tick by default;
- repeated zero-damage collision callbacks.

Direct weapon/native melee/projectile/contact damage may trigger it when realized damage is positive.

---

# 4. Color treatment

The owner requires the splatter to use the victim's color.

Do not stamp the fighter color as a flat neon decal.

Derive a liquid palette from the victim color:

- main stain = victim hue, darkened approximately 25–40%;
- dense core = darker still;
- thin droplets / wet edge = closer to the original fighter color;
- alpha varies naturally.

Goal:
- blue fighter -> dark blue liquid stain;
- green fighter -> dark green liquid stain;
- orange fighter -> dark orange/brown liquid stain;
- etc.

Preserve hue identity while giving the mark liquid depth.

---

# 5. Shape realism

A convincing splatter should not be one circular blob.

Each impact stain should combine:

- irregular central blot;
- 4–18 satellite droplets depending on damage;
- strongly varied droplet radius;
- one or more directional elongated streaks for fast impacts;
- uneven alpha;
- occasional tiny isolated specks;
- randomized rotation and asymmetry.

Impact direction:
- when source position is known, spray/streak continues generally away from the damage source through the victim;
- when source direction is unavailable, use a radial/randomized splatter.

Weapon-family feel may affect the pattern without changing gameplay:

- pistol / light bullet: compact directional star + few droplets;
- automatic burst: smaller layered specks, aggregate close hits;
- shotgun: wider cone/scatter stain;
- heavy precision / Snipex: longer directional streak + larger central impact;
- melee: short arc/smear aligned with strike direction;
- grenade/blast: more radial distribution.

Do not make the effect graphically anatomical.
No body parts, wounds, organs, or gore assets.

---

# 6. Damage scaling

Stain size must reflect realized damage but remain bounded.

Suggested presentation bands:

- light hit: compact splat, ~18–30 px main footprint;
- medium hit: ~28–46 px;
- heavy hit: ~42–68 px;
- very heavy / explosive: may reach ~80 px but should not cover large sections of the arena.

Use sub-linear scaling (e.g. sqrt/log-like) rather than linear damage-to-size.

Shotgun pellets and rapid automatic hits should not stamp one full decal per pellet.

Aggregate close impacts on the same target in a short window so the floor does not become noise.

---

# 7. Performance architecture — mandatory

Do **not** maintain hundreds of persistent stain objects and redraw every decal individually every frame.

Use a persistent offscreen/cached stain surface:

`bloodFloorCanvas` / equivalent

- same world dimensions as Chamber 01;
- created/reset at match start;
- each resolved stain is painted into it once;
- normal frame path draws that surface **once** after the chamber and before floor pickups/fighters.

Recommended draw order:

1. cached Chamber 01
2. persistent damage-stain canvas
3. pickup slots / rarity under-light
4. normal engine fighters/projectiles/effects
5. transient foreground presentation

This makes hundreds of historical stains nearly constant-cost per frame.

Temporary spray:
- use a separate bounded/poolable short-lived presentation layer;
- do not reuse legacy FloatingText;
- avoid unbounded allocation;
- keep lifetime approximately 0.12–0.30 s.

The persistent stain canvas must reset on:
- new match;
- rematch/retry;
- next Quest stage;
- return/start fresh arena.

---

# 8. Integration point

Arsenal currently wraps `Fighter.prototype.takeDamage` and already computes:

`dealt = Math.max(0, before - this.hp)`

This is the correct authoritative place to emit generic damage-splatter events because it sees realized damage after scaling.

Requirements:
- only trigger when `dealt > 0`;
- preserve current damage telemetry;
- do not double-trigger from both `aqDamage()` and the wrapped `takeDamage()`;
- weapon-specific presentation may pass/source classification metadata, but there must be one damage-splatter authority.

---

# 9. Existing FANG blood asset relationship

Do not alter FANG's existing blood/mist behavior.

Arsenal may reuse:
- `speckBlood.webp`
- its proven source-atop tint approach

but should have its own lightweight damage-splatter renderer and floor-stain surface.

Do not copy FANG's 22,000-particle hunt-mist architecture into Arsenal impact effects.

---

# 10. Verification

Automated/runtime:
- positive direct damage creates exactly one logical splatter transaction;
- 0 realized damage creates none;
- MISS creates none;
- DoT/status damage does not spam stains;
- splatter color is derived from victim color, not attacker color;
- floor canvas persists between hits and resets at new match;
- rapid pellet/auto hits aggregate according to the chosen short window;
- chamber cache still builds once/reuses;
- stain canvas adds one composite draw per frame, not N historical decal draws.

Browser evidence:
- dark gun on new light-gray floor;
- light-colored gun/effect still visible;
- two differently colored fighters receive hits and leave visibly different colored stains;
- pistol impact;
- shotgun impact;
- heavy/sniper impact;
- melee impact;
- multiple hits over time show persistent floor history without large FPS regression.

Owner review at normal speed is mandatory.

---

# 11. Scope notes / unresolved items

This visual addition does not solve these still-pending systems:

- gun pickup-ready audio implementation;
- real casing/shotshell landing source integration;
- Smoothness Pass 2A rarity/particle optimization;
- damage-number atlas;
- five heal-pickup runtime integration;
- exact five heal restore values remain unverified in the audited Arsenal code.

Do not silently invent those heal amounts.
