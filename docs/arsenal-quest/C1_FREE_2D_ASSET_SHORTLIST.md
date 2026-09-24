# ARSENAL QUEST C1 — FREE 2D-FIRST ASSET SHORTLIST

Researched: 2026-09-24
Owner correction: **GUN FAMILY, not Pistol-only.**
Production preference: **native 2D > 3D render**, non-pixel, high contrast, bold silhouettes,
clear color separation, visually distinct weapon classes.

This document supersedes the earlier 3D-first recommendation in `C1_FREE_ASSET_SHORTLIST.md`.
3D packs remain fallback/reference only.

---

# 1. NON-NEGOTIABLE VISUAL FILTER

A candidate is useful only if it can plausibly satisfy:
- native 2D PNG/SVG/vector preferred;
- crisp silhouette at ~90–190px gameplay size;
- strong dark/light separation;
- color accents that help classes differ;
- not washed-out grey-on-grey;
- not realistic-photo military rendering;
- not pixel art;
- no baked background;
- weapon can rotate toward opponent without perspective looking broken;
- source can be recolored/reprocessed legally.

The owner explicitly rejects the current “muted/samey” look.

---

# 2. GUN FAMILY — PRIMARY CANDIDATES

## A. senko_otter — weapon 2d models pack
Source: https://senko-otter.itch.io/weapon-2d-models

Why it is important:
- native **2D vector**;
- currently 21 weapons (+ skins in latest listing);
- SVG source;
- author states free use and no attribution required;
- no generative AI used;
- easy to recolor and impose an Arsenal palette without raster degradation.

Potential role:
- strongest current **technical fit** for the GUN FAMILY proof;
- sample compact/automatic gun + shotgun/heavy gun + long gun/sniper/rifle from the same family.

Risk:
- visual quality/style still requires owner-side inspection; being vector/free does not mean it
  automatically satisfies the desired contrast/personality.

Status: **SHORTLIST A — MUST VISUALLY AUDITION.**

## B. ItzNinjaFool — 2D Gun Pack
Source: https://opengameart.org/content/2d-gun-pack

Facts:
- 2D;
- CC0;
- guns / pistols / rifles / grenades;
- separate weapon files;
- explicitly free to edit.

Potential role:
- useful because it may solve **gun + grenade continuity from one family**.

Risk:
- small archive and simpler source; preview must be judged at actual Arsenal size before use.

Status: **SHORTLIST B — GUN/GRENADE CONTINUITY CANDIDATE.**

## C. Kay Lousberg — 2D Guns
Source: https://kaylousberg.itch.io/gun-assets

Facts:
- CC0;
- separate PNG, @2x PNG, spritesheet and SVG;
- Pistol/Revolver/Shotgun/Sniper/SMG/Assault Rifle + grenade/accessories.

Decision:
- technically excellent source format;
- **already used by current prototype and rejected by owner aesthetically**:
  too muted/samey for the desired Arsenal identity.

Status: **REFERENCE / REJECT AS FINAL STYLE.**
Keep only as functional fallback and scale/orientation reference.

---

# 3. HEAVY MELEE — BATTLE AXE

## A. Kutejnikov — Axes
Source: https://opengameart.org/content/axes-0

Facts:
- native 2D;
- hand-painted;
- CC0;
- 5 battle versions + 1 lumberjack version;
- 1024×1024 PNG.

Why promising:
- much higher source resolution than old inventory-icon packs;
- hand-painted mass can support the desired “hang -> crush -> stuck/yank” fantasy;
- multiple battle variants allow owner selection instead of taking one generic axe.

Risk:
- fantasy material language may need a controlled Arsenal recolor/outline pass to coexist with guns.

Status: **SHORTLIST A — PRIMARY BATTLE AXE AUDITION.**

## B. RGSDev — Free CC0 Melee Weapon Vector Sprites / Generator
Source: https://opengameart.org/content/free-cc0-melee-weapon-vector-sprites

Facts:
- CC0;
- customizable blade / guard / grip / pommel / decoration;
- intended for swords, axes, hammers, staffs;
- vector-style source workflow.

Why useful:
- can intentionally design silhouette instead of accepting a stock axe;
- useful if Kutejnikov looks too fantasy-painted compared with the final gun family.

Risk:
- generated assets can look generic if no art-direction constraints are imposed.

Status: **SHORTLIST B — CUSTOMIZABLE FALLBACK.**

---

# 4. DEFENSE — TOWER / SWIRL SHIELD

## A. CraftPix — Free Shield 2D Game Assets Pack
Source: https://craftpix.net/freebies/free-shield-2d-game-assets-pack/

Facts:
- 40 items;
- 8 shields × 5 upgrade variants;
- vector;
- AI / EPS / PNG;
- free download with CraftPix royalty-free usage terms.

Why promising:
- naturally stronger color separation and more authored detail than the existing muted source family;
- multiple levels can be mined for one strong Tower silhouette and one distinct Swirl silhouette.

Risk:
- RPG/chibi aesthetic may be too decorative;
- license is CraftPix's royalty-free licence, **not CC0** — preserve terms/provenance.

Status: **SHORTLIST A — VISUAL AUDITION REQUIRED.**

## B. RGSDev vector workflow
Use only if CraftPix's shield language cannot be reconciled with gun/melee art.

Status: **SHORTLIST B.**

---

# 5. GRENADE / EXPLOSIVE

The grenade must satisfy the continuity law:
**floor pickup == equipped object == thrown object**.

## A. Prefer grenade from the winning GUN FAMILY
First preference:
- if the selected gun pack has a strong grenade, use it;
- this is why the ItzNinjaFool pack remains useful despite being smaller.

This is superior to mixing a random bomb icon into a gun family.

## B. Selfish_babu — Cartoon Characters and Objects Vector Pack
Source: https://opengameart.org/content/cartoon-characters-and-objects-vector-pack

Facts:
- CC0;
- hand-drawn/vectorised/coloured;
- includes gun, bomb, grenade and other objects;
- explicitly colorful/bold tags.

Potential role:
- grenade silhouette / color-language reference;
- possible source if it survives side-by-side comparison.

Risk:
- broad mixed-object pack, not an Arsenal-specific weapon family.

Status: **SHORTLIST B — GRENADE REFERENCE/CANDIDATE.**

## C. Standalone CC0 bomb/vector assets
OpenGameArt has multiple CC0 bomb vectors, but a standalone bomb is a last resort because it makes
family coherence harder.

Status: **FALLBACK ONLY.**

---

# 6. EXPLICIT REJECTIONS FOR THIS ROUND

Do not spend owner review time on:
- Quaternius / Kenney low-poly weapon sources as primary weapon art;
- muted low-poly 3D renders;
- pixel-art weapon packs;
- grey military-photo/realistic 2D cutouts;
- current Kay Lousberg palette as final art;
- tiny inventory icons that collapse when equipped at combat scale.

3D is allowed only if later needed for:
- arena geometry reference;
- rendering a missing silhouette after all strong 2D options fail.

---

# 7. C1 VISUAL BOARD — CORRECTED SCOPE

Do NOT proof one Pistol.

The first owner board must show:

## GUN FAMILY
At least 3 same-family gun silhouettes:
1. compact/automatic — SMG or compact rifle;
2. heavy/close — Shotgun;
3. long — Sniper or long rifle.

Candidate family rows:
- senko_otter
- ItzNinjaFool
- current Kay Lousberg only as rejected baseline/reference

The owner judges:
- shape diversity;
- color diversity;
- contrast;
- outline;
- readability while rotating;
- whether all gun classes still feel related without feeling identical.

## BATTLE AXE
- Kutejnikov battle variants
- RGSDev custom vector alternative

## GRENADE
- grenade from winning gun family first
- Selfish_babu vector grenade as alternate

## TOWER SHIELD
- CraftPix free shield candidates
- custom vector fallback

No Agent may choose the winner.
The lead prepares the board; the owner chooses or requests a hybrid/repaint.

---

# 8. EXPECTED REPROCESS PASS

Even a winning free asset should be expected to receive one controlled Arsenal pass:
- normalize outline width;
- increase dark/light contrast;
- tune saturation;
- establish one light direction;
- unify edge highlights;
- remove unnecessary decorative noise;
- normalize pivots/anchors;
- enforce gameplay scale.

The goal is not “find one magical free pack that needs zero work.”
The goal is **find strong 2D source art that survives a small coherent reprocess**, rather than
starting from washed-out assets that cannot be rescued cheaply.
