# Arsenal Quest — Correction Pass Report

Status: COMPLETE  
Target branch: `prototype/arsenal-quest`  
Validated implementation SHA: `912835bc1aec2b8a7ef1ad711917c4bd0e3376f5`  
Successful CI run: `35953866408`

## Scope completed

This pass corrected the three blocking issues identified after the first AV integration:

1. real P0 weapon artwork was required for floor pickups and equipped fighters,
2. reveal timing was changed from age-based reveal to proximity-predicted reveal,
3. attack/shield VFX were rebound to semantic timing and world-space attack/contact geometry.

No progression, bosses, economy, inventory, extra weapons, multiplayer, or broad UI redesign was added.

## Weapon atlas integrity

The previously committed atlas was found to be truncated/corrupted.

The healthy atlas was restored from the already-curated 12 P0 source sprites.

Runtime file:

`public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.png`

Integrity:

- Git blob SHA: `4e26c52ba4a5c96465bf04d71811864e1e5f8ed2`
- SHA-256: `bb11c1c7df0a274b6e1106f074295c0ffe0b84a4c86ae964f068eeaa42b01f6f`

The SHA-256 matches the generation-time hash already recorded in:

`public/assets/arsenal/weapons/PROVENANCE.md`

Atlas metadata:

`public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.json`

All 12 P0 cells are represented:
PISTOL, SHOTGUN, SMG, SNIPER, GRENADE, SABRE, BATTLE_AXE, DAGGER, SPEAR, SPIKED_CLUB, SWIRL_SHIELD, TOWER_SHIELD.

## Real weapon rendering

Normal revealed pickups no longer use colored circles / three-letter tags as the primary world-space representation.

`arsenalSpawnRuntime.js` now calls the Arsenal presentation layer to draw the real atlas sprite using the committed content-box metadata.

The old placeholder map is retained only for secondary feedback / debug fallback coloring.

Equipped fighters now render the real weapon sprite in world space through:

`APEX_ARSENAL_AV.drawEquippedWeapon(...)`

Behavior by category:

- ranged art points with fighter attack direction,
- melee art is rotated from the source's upright authoring orientation onto fighter facing,
- shields remain visibly carried while guard is active,
- world-space weapon-name text is debug-only.

## Correct proximity reveal law

The old behavior:

`spawn -> wait 1.2–1.8s -> reveal`

was removed.

Each TELEGRAPH now stores:

`revealLeadSeconds = random(1.2, 1.8)`

This is a look-ahead threshold, not slot age.

For each hidden slot the runtime predicts time-to-contact for each living, pickup-eligible fighter by simulating the fighter's current Apex direction / speed forward with arena wall bounces.

Fields now tracked per slot:

- `predictedHeroETA`
- `predictedRivalETA`
- `earliestETA`
- `predictedFighter`
- `revealLeadSeconds`

The weapon identity remains `null` while no eligible fighter is predicted to reach the slot inside its threshold.

A slot may remain hidden for many seconds.

Example from real-browser acceptance:

`[AQ] REVEAL id=1 weapon=GRENADE eta=1.13 lead=1.50 fighter=HERO`

Browser QA also verified a hidden slot staying TELEGRAPH for more than 6 seconds with no approaching eligible fighter.

Spawn cadence remains independent of reveal / collection state.

## VFX semantic corrections

### Telegraph / reveal

Slash-family art is no longer used for pickup telegraph or reveal.

- telegraph: neutral marker + telegraph audio
- reveal: neutral shockwave / particles + reveal audio

### Guns

Muzzle cues are emitted from weapon-front offsets rather than fighter center.

`gunMuzzleDistance(...)` provides weapon-specific barrel offsets for:
- Pistol
- SMG
- Shotgun
- Sniper

### Melee

Melee attack cues now fire only at the strike/dash timing.

`meleeSwingAnchor(...)` provides weapon-specific forward geometry.

- Sabre: forward fast arc
- Battle Axe: larger/heavier chop anchor
- Dagger: compact dash/stab trail emitted when dash begins
- Spear: thrust-oriented streak family
- Spiked Club: restrained swing plus blunt hit feedback

`melee_hit` is emitted only after confirmed contact.

Whiffs do not emit target-hit feedback.

### Shields

Swirl Shield:
- persistent visual is the equipped real shield sprite,
- reflect VFX is emitted at the actual projectile contact coordinates,
- VFX angle follows the reflected projectile direction,
- projectile ownership reversal remains correct.

Tower Shield:
- persistent visual is the equipped real shield sprite,
- block VFX is emitted on the current incoming-hit side,
- block cue is not anchored to the old shield activation position.

## Files materially changed during the correction pass

Core/runtime:

- `public/assets/arsenal/weapons/arsenal_p0_weapon_atlas.png`
- `public/game/arsenal/arsenalQuestConfig.js`
- `public/game/arsenal/arsenalSpawnRuntime.js`
- `public/game/arsenal/arsenalPresentationRuntime.js`
- `public/game/arsenal/arsenalWeaponRuntime.js`
- `public/game/modes/arsenalQuestRuntime.js`

QA:

- `tools/testArsenalQuestHeadless.mjs`
- `tools/testArsenalQuestRuntime.mjs`

Authoritative docs:

- `docs/arsenal-quest/CORRECTION_PASS_HANDOFF.md`
- `docs/arsenal-quest/CORRECTION_REVIEW_CHECKLIST.md`

## Verification

Successful GitHub Actions run:

`35953866408`

### Headless

`pnpm test:arsenal:headless`

Result:

- 61 / 61 gates PASS
- 0 failed gates
- 5-minute deterministic simulation PASS
- 9,000 steps at 30 Hz
- 0 uncaught errors
- reveal look-ahead values remained in 1.2–1.8s
- structured SPAWN_SLOT / REVEAL / PICKUP / USE / HIT / CONSUME logs present

A non-fatal pre-existing harness load limitation remains for `soccerChampionRuntime.js`:
`image.addEventListener is not a function`.
It does not affect Arsenal acceptance and did not produce an Arsenal failure.

### Production build

`pnpm build`

PASS.

Production artifact from successful CI:

- artifact: `arsenal-quest-production-build`
- artifact ID: `10789831037`

### Real browser

`pnpm test:arsenal` using Google Chrome 153

Result:

- 44 / 44 gates PASS
- 0 failed gates
- proximity reveal PASS
- long-hidden telegraph PASS
- all existing 12 weapon behavior gates PASS
- shield reflect ownership PASS
- Tower Shield damage reduction / slow / expiry PASS
- normal Apex modes still launch
- five-minute browser simulation PASS with 0 uncaught errors

Browser evidence artifact:

- artifact: `arsenal-quest-browser-evidence`
- artifact ID: `10789008837`

## Representative browser evidence

Generated evidence includes:

- `01-hidden-telegraph.png`
- `02-multiple-simultaneous-pickups.png`
- `03-hero-pickup.png`
- `04-rival-pickup.png`
- `05-ranged-sniper-aim.png`
- `05b-ranged-pistol-burst.png`
- `06-melee-axe-slash.png`
- `07-tower-shield-guard.png`
- `07b-swirl-reflect.png`
- `08-f3-debug-overlay.png`

The successful browser report records:

- long-hidden slot after 6.1 seconds: still TELEGRAPH, weapon identity null
- proximity reveal: ETA 1.13s vs lead 1.50s
- 44 / 44 browser gates passing

## Known presentation limitations

This correction pass fixes semantics and asset usage, not final art direction.

Remaining polish work for a later UI/feel pass:

- weapon scale / hand offset can be art-directed further per sprite,
- the blank HERO/RIVAL chassis is still visually prototype-like,
- current HUD / debug styling is intentionally utilitarian,
- slash packs are now correctly event-bound, but individual frame choice / scale can still receive aesthetic tuning after owner playtest,
- no new UI shell / quest presentation was added.

## Product conclusion

The previous blocking defects are resolved at the implementation level:

- real weapon art is now rendered,
- hidden slots no longer reveal from age alone,
- proximity look-ahead controls reveal,
- attack VFX no longer decorate unrelated pickup events,
- melee/gun/shield effects are anchored to their gameplay geometry.

The next step should be owner playtesting of the corrected build before adding new gameplay systems.
