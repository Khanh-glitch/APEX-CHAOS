# APEX CHAOS // POST-C RUNTIME GAP AUDIT

**Date:** 2026-09-25  
**Branch:** `arena/01a0cf5e-apex-chaos`  
**Audited branch tip:** `ad077dd5177b81c74d237ef201c8c84a0a44bfa6`  
**Audited implementation SHA:** `33aedcc4cae839e75e499352b734b1306c0ffd58`  
**Status:** CONTINUATION REQUIRED — CI GREEN DOES NOT YET PROVE OWNER CONTRACT

This audit is not a redesign. It identifies concrete runtime gaps between the frozen owner authorities and the implementation that currently reports 111/111 headless and 69/69 browser.

## 1. KeyJ is still not wired through the actual Arsenal key path

`public/game/modes/arsenalQuestRuntime.js::onKeyDown` handles F3, T, B and Escape but does not handle `KeyJ`.

Current headless `postc-p1-j-activates` directly calls `gate.pressJ(fighters[0])`, so it proves the gate API but not real player input.

Required:
- edge-trigger real `KeyJ` -> `APEX_ARSENAL_SKILL_GATE.pressJ(fighters[0])`;
- ignore repeat;
- Arsenal-only;
- real-browser keyboard-event gate.

## 2. Existing browser 69/69 does not cover most new authority

Current browser report has no dedicated gates proving:
- actual KeyJ;
- full rarity system;
- COUNTER_RESERVED state transitions;
- per-weapon muzzle/casing anchors;
- per-gun SFX/VFX/exit identity;
- Z15 skin ballistic identity;
- Beretta/M16 burst-pause-burst grammar;
- M249 vs MAC-10 presentation distinction;
- Magnum revolver casing rule;
- Sawed-off no-rack rule;
- precision multi-shot grammar.

Passing the current 69 gates is therefore necessary but not sufficient.

## 3. Weapon identity data is declared but not fully consumed

`arsenalIdentityRuntime.js` declares fields such as:
- `sfxRate`
- `vfx`
- `exit`
- `burstPause`
- `burstSize`
- `casingFan`
- `noPumpRack`
- `hullOnExit`

The runtime does not currently implement all of these observable semantics.

The correction pass must either wire each frozen field into real runtime behavior or remove/rework the declaration so the authority and implementation cannot drift.

## 4. BURST grammar is not implemented

`makeGun()` currently advances every shot by `spec.interval`.

Therefore:
- Beretta 93R does not actually perform 3 shots -> pause -> 3 shots;
- M16 does not actually perform 3 shots -> pause -> 3 shots.

Implement `burstSize` + `burstPause` in the sequential firing executor and test exact shot timestamps.

## 5. Precision multi-shot grammar is broken

`makePrecisionGun()` currently:
1. aims;
2. fires one bullet using `spec.damage`;
3. consumes immediately.

Therefore declared:
- MBR `shots:2, damage:11`;
- MBR2 `shots:2, damage:14`;
- SZECSEI_FUCHS `shots:2, damage:15`;

do not currently execute as two-shot weapons.

Existing browser evidence even logs an MBR2 hit for 14 damage, confirming only one shot landed before consume.

Implement the authored precision sequence, including interval / second-shot mechanism and physical exit only after final commit.

## 6. Per-weapon muzzle anchor is not actually consumed

Generated weapon-set metadata already contains normalized `muzzle` coordinates.

Current projectile origin still uses fighter-relative `f.radius * 0.7`, while AV muzzle placement still uses `gunMuzzleDistance()` heuristics.

Required:
- one canonical transform from weapon metadata -> equipped world transform;
- projectile origin, muzzle flash and muzzle smoke all derive from the actual weapon muzzle coordinate;
- fallback heuristic only if metadata is absent.

## 7. Per-weapon casing anchor is not actually consumed

Current `ejectCasing()` computes origin from fighter position + generic rear/side vector.

Required:
- use generated weapon `casing` anchor transformed through the equipped sprite transform;
- keep the rear-side random cone, spin, gravity and bounded bounce;
- fallback only if casing metadata is absent.

## 8. Sawed-off flags are not respected by the SHOTGUN executor

`makeBlastGun()` currently calls:
- `window.avCue('shotgun_rack', ...)` unconditionally;
- `ejectCasing(f, base, 1.4)` without passing the weapon id.

Thus `SAWED_OFF.noPumpRack` and `SAWED_OFF.noCasing` cannot reliably affect this path.

Required:
- condition rack cue by the current weapon spec;
- pass weapon id to casing logic;
- defer sawed-off hull ejection to the authored break-open exit.

## 9. Weapon-specific exit identity is mostly declarative only

Identity values such as:
- `magDrop`
- `breakOpen`
- `cylinderSpill`
- `noseSlump`
- `cassetteSpin`
- `longDrop`

are not currently mapped to concrete exit behavior.

`snapshotPoseGhost()` only has explicit `exitRot` values for a small legacy subset. Most new guns therefore use one generic drop.

Required:
- a data-driven exit executor;
- every gun maps to an observable physical exit;
- semantic component separation only where a trustworthy part map exists;
- otherwise whole-body weapon-specific drop/toss/spin;
- no instant vanish.

## 10. Per-weapon SFX/VFX identity is still mostly declarative

Fields `sfxRate` and `vfx` exist in the identity registry but are not fully consumed by the actual AV pipeline.

Required:
- AV fire cue reads weapon id / identity recipe;
- approved source sounds remain unchanged;
- playback recipe may vary gain/rate/filter/mechanism timing within the frozen authority;
- muzzle/smoke profile must use the frozen per-archetype/per-weapon identity rather than only old family defaults.

## 11. Rarity under-light lacks tier hierarchy

Current revealed pickup draw uses the same:
- ellipse size `34 x 10`;
- alpha `0.35`;

for all tiers and only changes hue.

Frozen authority requires higher tiers to increase:
- glow radius;
- luminance;
- pulse amplitude;

with Legendary receiving a restrained warm shimmer.

Implement data-driven tier presentation while preserving authored weapon colors and no battlefield rarity text.

## 12. COUNTER_RESERVED state does not yet implement the full reservation law

Current behavior:
- creates `COUNTER_RESERVED`;
- after 8 seconds marks the slot REMOVED;
- pickup resolution allows whichever unarmed fighter is closest to collect a reserved slot.

Frozen authority requires:
- reservation belongs to `reservedFor`;
- only that fighter may resolve the reserved shield;
- continuously revalidate bound opponent weapon, reserved fighter armed state, fighter life, and valid contact trajectory;
- if reservation becomes invalid, return slot to normal TELEGRAPH/reveal law — do not delete the slot;
- no permanent reservation and no shield leakage to the other fighter.

## 13. Shield transaction must be explicitly verified

Existing holder cleanup tracks the bound weapon and its projectiles, which is a useful base.

Add direct tests proving:
- P90/M249 volley is protected as one bound transaction rather than one bullet;
- shotgun fan is one Tower transaction;
- grenade/explosion is one Tower transaction;
- bound shield exits after that transaction;
- shield never carries to the next unrelated weapon.

## 14. Envelope audit must use the frozen authority

The generated audit document changed the stated bands to T2 16–22 / T3 22–28 / T4 28–34.

The frozen authority remains:
- T1 ~13–16
- T2 ~17–20
- T3 ~21–25
- T4 ~27–31
- T5 ~35–40

Do not silently redefine the owner envelope in an audit report.

Balance against expected landed effectiveness, not full-connect damage alone.

## 15. Known allowed disclosure

`Zbroyar Z-15 skin3.svg` remains 0 bytes.

This is not a completion blocker if:
- the limitation stays explicitly disclosed;
- the derived visual fallback is not claimed as an independent original Senko source;
- its combat identity stays identical to the Z15 base/S1/S2 family.

## 16. Completion requirement for the next pass

The continuation is complete only when:

1. real KeyJ works in-browser;
2. burst grammar is real;
3. precision two-shot grammar is real;
4. muzzle metadata drives projectile/VFX origin;
5. casing metadata drives casing origin;
6. Sawed-off obeys no-rack/no-per-shot-casing;
7. identity exit strings produce actual distinct exits;
8. SFX/VFX identity fields are actually consumed;
9. tier glow hierarchy is visually real;
10. COUNTER_RESERVED invalidation/restoration and reserved-fighter ownership are correct;
11. shield transaction tests cover an entire volley;
12. new real-browser gates prove the new authority instead of relying on the legacy 69-gate suite;
13. all existing regression gates remain green;
14. normal-speed visual review is performed.

Do not move `playtest/arsenal` until this audit is closed.
