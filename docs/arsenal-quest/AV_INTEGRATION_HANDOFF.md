# ARSENAL QUEST — VFX / SFX INTEGRATION HANDOFF

Status: AUTHORITATIVE PRESENTATION TASK  
Target branch: `prototype/arsenal-quest`  
Current branch baseline at handoff creation: `69d6d94ab5753d50ecdbc4c3798196f3f842eb52`

> **IMPORTANT CORRECTION OVERRIDE:** `docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md` supersedes this file where it changes weapon sprite integration, reveal timing semantics, telegraph/reveal VFX semantics, and attack-effect positioning.

## 0. Purpose

The Arsenal Quest core mechanic already passes architecture, headless QA, production build, and real-browser acceptance.

This task is NOT a gameplay expansion.

The current problem is presentation:

> Weapons, hits and defenses work mechanically, but the mode still feels like a prototype because pickups / attacks rely too heavily on placeholder circles, text labels and generic effects.

This pass upgrades only **VFX + SFX integration** for the existing 12 P0 weapons and shared pickup lifecycle.

Do NOT add:
- quests
- leveling
- bosses
- progression
- rarity
- economy
- inventory
- more weapons
- weapon-seeking AI
- multiplayer
- a new rendering engine
- a broad UI redesign yet

The UI redesign is a later pass. First make the battlefield itself feel materially better.

---

## 1. Runtime assets are already committed

The curated VFX/SFX runtime subset is already present in Git under:

```
public/assets/arsenal/av/
  vfx/
    muzzle_flash/
    slash_orange_primary/
    slash_blue_shield/
    explosion_pack_2/
  sfx/
    guns/
    impact/
    rpg/
    scifi/
```

Do **not** ask the project owner for a ZIP.

Do **not** search for replacement assets or substitute random internet packs.

The assets were bootstrapped from the original CC0 source pages by:

`.github/workflows/arsenal-av-bootstrap.yml`

Source/license evidence is stored in:

`public/assets/arsenal/av/PROVENANCE.md`

Per-file SHA-256 and sizes are stored in:

`public/assets/arsenal/av/MANIFEST.csv`

Use the committed runtime assets directly.

Preserve the curated filenames unless there is a strong technical reason not to.

---

## 2. Curated pack contents

### Muzzle flash

Preferred runtime asset:

`vfx/muzzle_flash/muzzleFlash0_transparent.png`

- 512×128
- 4 horizontal frames
- black background already converted to alpha
- use this file, not the black-background reference, for normal canvas rendering

Reference only:

`vfx/muzzle_flash/muzzleFlash0_original_black.png`

### Primary warm melee slash family

`vfx/slash_orange_primary/Alternative_3_01.png` through `Alternative_3_30.png`

Use as the visual family for:
- Sabre
- Battle Axe
- Dagger
- Spear
- Spiked Club

Do not randomly cycle all 30 images per attack.

Treat the 30 images as grouped animation frames / visual candidates. Inspect the sequences and build stable weapon-specific animations from them.

### Cool shield / reflect family

`vfx/slash_blue_shield/Alternative_2_01.png` through `Alternative_2_30.png`

Use only where semantically justified:
- Swirl Shield successful reflect/contact
- optional Sniper charge/shot accent if visually coherent

Do NOT use slash-family frames for generic pickup telegraph, reveal, or unrelated ambient decoration.

Do not reuse the blue family for every gun just because it exists.

### Explosion family

Recommended gameplay atlases:

`vfx/explosion_pack_2/half/1.png` through `4.png`

Optional larger variants:

`vfx/explosion_pack_2/full/1.png` through `4.png`

Use half-size first for Grenade to avoid oversized screen coverage.

Inspect atlas layout before implementation. Do not assume frame count / grid dimensions without checking the actual image.

---

## 3. Audio mapping — authoritative first pass

### Shared lifecycle

**Telegraph appears**
- `sfx/scifi/forceField_001.ogg`
- low volume
- short / non-annoying
- should create anticipation, not sound like a hit

**Reveal**
- `sfx/rpg/metalClick.ogg`
- optionally layer a very light `impactGeneric_light_002.ogg`
- keep reveal sharper than telegraph

**Pickup**
Primary:
- `sfx/rpg/metalLatch.ogg`

Optional alternate layer:
- `sfx/impact/impactGeneric_light_002.ogg`

Pickup must be audible but must not overpower gunshots / impacts.

### Firearms

**Pistol**
- main: `sfx/guns/cz.wav`
- muzzle: `muzzleFlash0_transparent.png`
- optional alternate / later variant: `sfx/scifi/laserSmall_002.ogg`

**Shotgun**
- main: `sfx/guns/shotty.wav`
- muzzle: same sheet but larger scale / stronger flash
- impact layer may use `impactPunch_heavy_001.ogg` or `impactMetal_heavy_002.ogg` depending target feedback

**SMG**
- source: `sfx/guns/sks.wav`
- do NOT replay the entire source file eight times without checking duration / overlap
- either trim/slice in code, use short bounded playback, or choose a technically clean repeated-shot approach
- muzzle flash should pulse per shot but not produce strobe-like unreadable spam

**Sniper**
- shot: `sfx/guns/mosin.wav`
- optional charge layer: `sfx/scifi/laserLarge_003.ogg`
- muzzle flash should be visibly larger / more decisive than pistol
- do not make charge sound louder than the shot

### Grenade

Explosion visual:
- one coherent animation selected from `explosion_pack_2/half`

Explosion audio:
- `sfx/scifi/explosionCrunch_002.ogg`
- optional low-end layer: `sfx/scifi/lowFrequency_explosion_001.ogg`

Do not play both layers at full volume.

The low-frequency layer is support, not the primary transient.

### Melee

**Sabre**
- visual: orange slash family, fast / clean sequence
- SFX: `sfx/rpg/knifeSlice.ogg`

**Dagger**
- visual: compact / quick orange slash or streak sequence
- SFX: `sfx/rpg/knifeSlice2.ogg`
- draw/equip optional: `drawKnife1.ogg`

**Spear**
- visual: use orange streak/thrust-looking frames rather than a broad crescent if possible
- SFX: knife slice as air movement + medium body impact on hit

**Battle Axe**
- visual: heavier orange arc / impact sequence
- SFX: `sfx/rpg/chop.ogg`
- hit: `sfx/impact/impactPunch_heavy_001.ogg` or `impactMetal_heavy_002.ogg`

**Spiked Club**
- visual: do not present it like a sword slash if the family contains a better streak/impact frame
- SFX: `sfx/rpg/chop.ogg` only if it reads well; otherwise favor `impactPunch_heavy_001.ogg`
- stun should have a clear impact cue, not just text

### Defensive

**Swirl Shield activation**
- `sfx/scifi/forceField_003.ogg`
- visual: blue family

**Swirl Shield successful reflect**
- `sfx/scifi/impactMetal_002.ogg`
- optional additional light plate hit: `impactPlate_light_001.ogg`
- visual must clearly show ownership reversal direction / flash

**Tower Shield activation**
- `sfx/scifi/forceField_003.ogg` at restrained volume

**Tower Shield block**
- `sfx/impact/impactPlate_heavy_001.ogg`
- light blocked contact may use `impactPlate_light_001.ogg`

---

## 4. Architecture requirements

Reuse the current Arsenal implementation.

Relevant files already exist:

```
public/game/arsenal/arsenalQuestConfig.js
public/game/arsenal/arsenalWeaponRuntime.js
public/game/arsenal/arsenalSpawnRuntime.js
public/game/modes/arsenalQuestRuntime.js
```

Do not put asset-specific conditionals all over the engine.

Add a small isolated presentation layer, recommended:

```
public/game/arsenal/arsenalPresentationRuntime.js
```

or equivalent.

Responsibilities may include:
- image preload / cache
- audio preload / cache
- frame animation state
- world-space VFX instances
- muzzle-flash animation
- explosion-atlas animation
- slash animation
- pickup/reveal audio hooks
- bounded polyphony / audio throttling

Then register it in the Arsenal runtime group in dependency order.

Do not duplicate the Apex main draw loop.

Do not introduce a second audio engine if existing browser/Apex audio utilities are reusable.

---

## 5. Runtime / performance rules

### Audio

Avoid creating unlimited overlapping `Audio()` elements.

Use:
- a bounded pool,
- reusable buffers,
- or existing Apex audio machinery where practical.

Required protections:
- pickup/reveal sounds cannot stack infinitely when many items spawn
- SMG cannot create uncontrolled audio overlap
- repeated impact sounds need mild throttling / concurrency limits
- no unhandled autoplay promise rejection

### VFX

Do not allocate large images every frame.

Preload once.

World-space VFX must:
- expire cleanly
- not retain stale fighter references
- not block gameplay update
- survive camera transform correctly
- not draw outside Arsenal mode unless intentionally shared

### Draw order

Recommended order:
1. arena/background
2. telegraph / floor pickup
3. fighters
4. weapon/projectile gameplay
5. slash / explosion / muzzle transient VFX
6. readable HUD / debug

Adjust only if current Apex draw architecture requires a different safe insertion point.

---

## 6. Gameplay preservation — mandatory

Do not alter the already-approved core unless required for VFX timing hooks.

Preserve:
- 3s spawn cadence
- proximity-predicted reveal using a per-slot 1.2–1.8s look-ahead threshold (not age-based reveal)
- multiple simultaneous pickups
- unrevealed slots non-collectable
- 100 HP blank HERO/RIVAL
- no pathfinding toward weapons
- current 12 weapon behaviors
- one held Arsenal item at a time
- current damage / timing values unless a presentation artifact exposes a clear bug

If a gameplay change is truly necessary, document it explicitly in the report.

---

## 7. What counts as a successful feel pass

The asset must communicate gameplay, not just decorate it.

### Telegraph
A player should notice where a drop is coming without knowing what it is.

### Reveal
The reveal should feel meaningfully different from telegraph.

### Pickup
The moment a fighter acquires a weapon should be readable without reading debug text.

### Gunfire
Pistol, Shotgun, SMG and Sniper must not feel like the same shot with different damage.

### Melee
Sabre, Axe, Dagger, Spear and Club must not all share the exact same slash timing/scale/orientation.

They may share one art family, but presentation must respect the weapon behavior.

### Defense
Shield activation and shield success must be visible and audible.

Reflect must be especially obvious.

### Grenade
Throw → fuse → explosion should read as a coherent sequence.

---

## 8. Acceptance checklist

The task is NOT complete just because files load.

Required:

1. Curated pack present under `public/assets/arsenal/av/`.
2. No duplicate source ZIPs committed.
3. Transparent muzzle-flash sheet is used, not black-background version.
4. Telegraph sound integrated and throttled.
5. Reveal sound integrated.
6. Pickup sound integrated.
7. Pistol has muzzle + gunshot.
8. Shotgun has distinctly heavier muzzle/audio.
9. SMG burst has controlled audio/muzzle repetition.
10. Sniper has distinct charge/shot presentation.
11. Grenade uses real explosion animation + explosion SFX.
12. Sabre uses real slash VFX + slice SFX.
13. Axe uses visually/heavily distinct melee feedback.
14. Dagger uses compact fast feedback.
15. Spear uses thrust-like feedback.
16. Club uses blunt impact feedback.
17. Swirl Shield activation and reflect use blue/defensive VFX + SFX.
18. Tower Shield block uses defensive SFX.
19. Existing 44-gate headless suite remains green.
20. Existing browser Arsenal acceptance remains green.
21. `pnpm build` passes.
22. Five-minute Arsenal simulation has no uncaught errors.
23. No obvious runaway audio overlap.
24. No obvious VFX memory leak.
25. Existing non-Arsenal Apex modes still open.

---

## 9. Required visual/audio evidence

Provide evidence captured from real browser runtime where possible:

1. pickup telegraph
2. weapon reveal
3. pistol firing
4. shotgun firing
5. SMG burst
6. sniper aim + shot
7. grenade explosion
8. sabre slash
9. battle axe hit
10. dagger attack
11. spear thrust
12. spiked club hit/stun
13. swirl shield reflect
14. tower shield block
15. multiple simultaneous pickups while VFX/audio remain stable

For audio, screenshot evidence alone is insufficient.

Report which exact files are bound to which events and confirm playback by runtime log / test hook.

---

## 10. Required report

Create/update:

`docs/arsenal-quest/AV_INTEGRATION_REPORT.md`

Include:
- final branch + SHA
- asset installation path
- exact files added
- exact runtime files changed
- asset-to-event mapping actually used
- any curated files intentionally unused
- audio concurrency design
- VFX animation design
- build result
- headless result
- browser result
- five-minute sim result
- evidence paths
- known visual/audio defects
- any gameplay changes (should normally be none)

---

## 11. Stop conditions

Stop and report instead of improvising if:

- committed Arsenal AV assets are missing from `public/assets/arsenal/av/`
- `MANIFEST.csv` indicates corrupted/missing files
- asset license/provenance evidence is missing for an asset you intend to ship
- a requested asset cannot technically render cleanly without destructive changes
- integrating an asset would require rewriting the Apex engine

Do not hide a missing asset by replacing it with a generic debug circle and calling the pass complete.

---

## 12. Product principle

This pass exists to answer:

> Does Arsenal Quest begin to feel exciting once the working mechanics receive credible audiovisual feedback?

Do not solve a presentation problem by adding more systems.
