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

- **Gun-fire baseline retained exactly as owner-approved**:
  `cz.wav` (Pistol), sliced `sks.wav` (SMG), `shotty.wav` (Shotgun),
  and `mosin.wav` (Sniper).
- **Owner-approved C1 FINAL SFX LOCK restored and integrated** from
  `tools/arsenal-assets/source/sfx/final-lock/APEX_C1_SFX_FINAL_LOCK.zip`
  (SHA-256 `cd1181a6c2957cd93dfbb32f41ad540a6918ec7eee03d34218434c0a4604ffac`).
  The deterministic materializer verifies the bundle and each runtime WAV
  before writing `public/assets/arsenal/av/sfx/c-final/`.
- **20 final-lock runtime WAVs are now in-repo and active**:
  Battle Axe motion/contact/body, Club swing/body, Dagger motion/contact,
  Sabre motion/cut, Spear motion/impact, Swirl Shield block, Tower Shield
  block, Grenade core/low body, Pistol mechanism click, Shotgun rack
  pull/push, and Sniper chamber/bolt lock.
- Exact trims/gain/source identities are preserved in
  `public/assets/arsenal/av/sfx/c-final/metadata/APEX_C1_FINAL_SFX_MAP.csv`.
- Runtime event mapping now uses the final-lock files at the actual semantic
  beats: melee motion on commit, melee contacts on hit, shield identities on
  block/reflect, grenade core+low layer on explosion, pistol mechanism on
  equip, shotgun rack micro-sequence after blast, sniper chamber during aim
  and bolt lock on the chamber gesture.
- **Removed the sci-fi sniper charge** and removed the old generic
  Kenney/RPG/scifi fallback mappings for the weapon events covered by the
  final lock. Shield activation itself is intentionally quiet; the approved
  shield sound is reserved for actual contact.
- Casing landing remains the restrained `impactPlate_light_001` utility cue
  because casing was not part of the final-lock bundle.
- QA now enforces the audio authority: `av-asset-map-complete` requires all
  final-lock event keys to resolve under `sfx/c-final/`, the four gun-fire
  keys to remain under `sfx/guns/`, and rejects the superseded fallback keys.
- Verified at `71b21fb7003fb6f5e0fbf6936453d9d9e4f6fc0b`: **96/96 headless** and **69/69 real-browser**.

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

- Headless (real engine + real canvas): **96/96 gates** including
  new C gates (`weapon-cset-*`, `av-muzzle-uses-warm-c-family`,
  `av-no-laser-charge-sfx`, `av-melee-contact-transients`,
  `c-projectile-speeds-v2`, `c-casing-ejected-on-fire`,
  `c-native-damage-normalized`, `c-power-telemetry-live`).
- `pnpm build` passes.
- Real-browser suite (CI, from pushed SHA `f27ad18`): **69/69 gates**;
  browser evidence + logs committed back as `e45671a`. Frames confirm the C
  set, tracers, casings, grenade continuity and Chamber 01 in a live browser.
- Evidence refreshed under `docs/arsenal-quest/evidence/` from this build:
  chamber arena, all gun firings, grenade continuity trio, melee contacts,
  shields, pickups.
- Final-lock re-verification at tip `c05fe4c` (this turn):
  `tools/materializeArsenalFinalSfx.mjs` reproduces all 20 WAVs
  byte-identical from the sha-locked ZIP; headless re-run 96/96 with all 20
  `sfx/c-final/` layers present in the scheduled-audio ring across the combat
  scenarios; CI at `e35819f` (last code-changing commit) ran headless +
  real-browser green.

## 12. No placeholders (DoD §12)

No TODO visuals shipped; slash sheets and the old atlas are unreferenced;
every cue maps to authored or curated assets.

## Open items for owner

1. Owner playtest / feel review of the completed Checkpoint C rebuild.
2. Tune tracer speeds / damage feel only if the owner playtest identifies a
   concrete problem; the current implementation is already fully integrated.
3. `playtest/arsenal` remains frozen until this build is reviewed.
