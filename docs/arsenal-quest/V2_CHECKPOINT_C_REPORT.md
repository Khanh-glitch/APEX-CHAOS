# ARSENAL V2 — CHECKPOINT C REPORT (FULL PRODUCTION REBUILD)

Branch: `arena/01a0cf5e-apex-chaos` · Authority: `C_FULL_REBUILD_EXECUTION_CONTRACT.md`
Pipeline: `tools/buildArsenalCAssets.mjs` → `public/assets/arsenal/weapons/c/` +
`public/game/arsenal/arsenalCWeaponSet.generated.js` (boot-registered in
`src/game/runtimeManifest.js`).

## 1. Weapon family (DoD §1)

All 12 P0 weapons now render from one authored set (`weapons/c/`), replacing
the A/B collage atlas (retained on disk only for audit, unreferenced):

- **Guns** — Senko v9 family, reprocessed into the constitution (graphite /
  dark-steel bodies, steel highlights, brass accents, original normalized
  outline, no baked glow): colt → PISTOL, MP5 → SMG, SPAS 12 → SHOTGUN,
  Snipex Alligator → SNIPER (tan body folded into graphite; body ≠ accent).
- **Bespoke authored in-repo** (original vector work, same flat-fill +
  outline language, one light direction): GRENADE, CASING, SABRE, BATTLE_AXE,
  DAGGER, SPEAR, SPIKED_CLUB, SWIRL_SHIELD, TOWER_SHIELD (natively tall kite —
  not a stretched round shield; see evidence `07-tower-shield-guard.png`).
- Scale hierarchy preserved: Dagger < Pistol < SMG/Sabre < Shotgun/Club/Axe <
  Spear/Sniper longest; Tower largest defense silhouette.
- Gun sprites never render upside-down: `keepUpright` mirrors across the aim
  axis when facing left.

## 2. Motion V2 (DoD §2)

- Anticipation on every equip: weapon arrives raised/cocked and the pose
  spring settles it (per-weapon offsets in `equip()`).
- Signature commits retained from B (pistol triple pulse, shotgun heavy kick,
  SMG 8-pulse climb, sniper ceremony→snap, grenade draw→throw, melee
  windup→strike, dagger/spear thrusts, shield pops).
- **Physical exits**: consumed weapons drop/rotate away (per-weapon exit
  rotation), heavies throw down, shields physically retract (scale-down),
  grenades scale out along the throw. Alpha is used only in the final 15% of
  the exit (`drawPoseGhost`), never as the primary consume read.

## 3. Grenade continuity (DoD §3)

One canonical authored sprite across pickup (`56px` floor draw) → equipped
(`62px`) → in flight (`40px`, spinning, fuse blink) → existing explosion.
Evidence: `21a-grenade-equipped.png`, `21b-grenade-in-flight.png`,
`av-07-grenade-explosion.png`. No Kay circle, no generic dot.

## 4. Tracers + swept collision (DoD §4)

- Speeds (§5.2): pistol 2600, SMG 3100, shotgun pellets 2500 @ 0.17s life,
  sniper 5800. Gate `c-projectile-speeds-v2` asserts the bands.
- Collision upgraded to swept segment vs fighter circle (`distPointToSegment`
  over prev→current); bullet radii untouched — no tunneling compensation by
  size.
- Rendering (§5.3): thin core prev→cur + bright head + capped afterimage;
  pistol short/fast, SMG finer rhythm, shotgun near-instant pellet fan,
  sniper long transient. No outlined ellipse balls (owner-rejected look gone).
- Impact hierarchy (§5.4): pistol 5-particle snap, SMG 3 (voice-limited),
  shotgun 9-cluster + push, sniper focused + hit-stop; no square-burst spam.

## 5. Spent casings (DoD §5)

Every gun shot ejects an open-mouth brass casing (`ejectCasing` → AV `casing`
vfx): arc/spin/fall with one floor bounce and bounded 0.9s life, alpha only in
the last 15%. Visible in `av-03`, `av-05` (SMG brass stream), `av-06b`.

## 6. Muzzle / smoke / explosion hierarchy (DoD §6)

Recolored warm toon-flash family (`vfx/c/muzzle_0..5`): pistol small crisp,
SMG fine alternating, shotgun broad + Kenney smoke puff, sniper stretched
long transient + smoke. Melee contact = weapon-specific spark transients
(Kenney CC0) — slash sheets fully removed from preload and dispatch.
Grenade explosion atlas retained per V2 §A4.

## 7. Audio (DoD §7)

- Kept baseline: cz (pistol), sks slices (SMG), shotty, mosin (sniper), Kenney
  impact/rpg mechanism layers, explosion pair.
- **Removed `sfx/scifi/laserLarge_003.ogg`** (sci-fi sniper charge) — gate
  `av-no-laser-charge-sfx`. Sniper chamber beat is now a restrained mechanical
  click; the weapon runtime's chamber event uses the existing metallic cue.
- Casing landings reuse `impactPlate_light_001` at 0.16 vol, voice-capped.
- **Restoration gap (documented, not substituted)**: the owner-PASSed Sonniss
  GDC 2026 melee/shield/grenade layers are not present anywhere in this
  repository and cannot be fetched (owner-side ZIPs only, per handoff §18).
  Per contract, no random SFX were substituted; the PASSed baseline +
  existing mechanism layers remain until the owner bundles Sonniss.

## 8. Chamber 01 (DoD §8)

`drawChamber01` renders only while `gameState === 'ARSENAL'` (global Apex
background untouched): dark graphite + radial material variation, restrained
range grid, sparse wall ticks, Z-01..04 stencil numerals, central alignment
marks, industrial panel walls + guard rail, corner vents, chamber plate.
No bright lanes, no center obstacle, no glow behind sprites.
Evidence: `20-chamber01-arena.png` and all combat frames.

## 9. Power hierarchy (DoD §9)

- Per-mechanic normalization active only in ARSENAL state
  (`aqAdaptedTakeDamage`): projectile 0.55 / blast 0.50 / beam 0.50 / dot 0.60
  / melee 0.70 / contact 0.85 / default 0.65 — configured in
  `NATIVE_ARSENAL_MULT`, classified by damage label + status flag.
- Identity untouched: statuses, pushes, locks, walls, summons, speeds, heals.
- Telemetry: `state.dmg.{weapon,native,byMechanic}` + `weaponDamageShare` in
  the debug state; gates `c-native-damage-normalized` (blast hit realizes at
  exactly 0.5× an equal arsenal hit) and `c-power-telemetry-live`.
- Roster matrix extended with §6.3 fields (signature identity, native direct
  sources, multiplier class, utility kept) for all 32.

## 10. Compatibility (DoD §10)

All 32 shells unchanged from B's KEEP/ADAPT decisions; rage stays off;
holder state untouched by native kits (existing QA gates re-pass).

## 11. Verification (DoD §11)

- Headless (real engine + real canvas, this SHA): **96/96 gates** including
  new C gates (`weapon-cset-*`, `av-muzzle-uses-warm-c-family`,
  `av-no-laser-charge-sfx`, `av-melee-contact-transients`,
  `c-projectile-speeds-v2`, `c-casing-ejected-on-fire`,
  `c-native-damage-normalized`, `c-power-telemetry-live`).
- `pnpm build` passes.
- Real-browser suite runs in CI from the pushed SHA (same path as B).
- Evidence refreshed under `docs/arsenal-quest/evidence/` from this build:
  chamber arena, all gun firings, grenade continuity trio, melee contacts,
  shields, pickups.

## 12. No placeholders (DoD §12)

No TODO visuals shipped; slash sheets and the old atlas are unreferenced;
every cue maps to authored or curated assets.

## Open items for owner

1. Sonniss bundle (owner-side) — swap-in point documented in §7.
2. Playtest tuning of tracer speeds / damage feel (contract allows drift).
3. `playtest/arsenal` remains frozen until this build is reviewed.
